import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@k3/shared-types';
import { ImportsRepository, type ImportRun, type ImportRunRow } from '@k3/repositories';
import {
  readWorkbookFromBuffer,
  parseSheet,
  parseAllSheets,
  type ParsedSheet,
  type ParsedRow,
} from './excel';

export type ImportTemplate =
  | 'machines'
  | 'services'
  | 'parts'
  | 'gas'
  | 'service_pricing'
  | 'contract_pricing'
  | 'customers';

export interface ValidationError {
  field: string;
  message: string;
}

export type RowAction = 'pending' | 'insert' | 'update' | 'skip' | 'error';

export interface PreparedRow {
  row_number: number;
  raw: Json;
  resolved: Json | null;
  errors: ValidationError[];
  action: RowAction;
  target_table: string | null;
  /** Closure that performs the actual insert/update during commit. Resolved when row is valid. */
  apply: ((db: SupabaseClient<Database>) => Promise<{ id: string }>) | null;
}

export interface ImporterContext {
  /** RLS-bound client (the user performing the import). */
  db: SupabaseClient<Database>;
  /** Optional row-by-row hook — useful for tests/logging. */
  onProgress?: (n: number, total: number) => void;
}

/**
 * An Importer takes a parsed workbook and produces PreparedRow[] without
 * writing anything to the target tables. The ImportService stores those
 * rows in import_run_rows for preview and, on commit, runs each row's
 * `apply` closure inside a single transaction-like loop.
 *
 * Each importer is independent — you can add new ones without touching
 * existing ones.
 */
export interface Importer {
  template: ImportTemplate;
  /** Does this importer accept a given parsed workbook? Used for auto-detection. */
  detect(sheets: ParsedSheet[]): boolean;
  /** Prepare rows from the workbook. */
  prepare(sheets: ParsedSheet[], ctx: ImporterContext): Promise<PreparedRow[]>;
}

/**
 * The orchestrator. Holds the RLS-bound Supabase client of the user
 * performing the import; never touches the service-role client.
 */
export class ImportService {
  private readonly imports: ImportsRepository;
  private readonly registry = new Map<ImportTemplate, Importer>();

  constructor(private readonly db: SupabaseClient<Database>) {
    this.imports = new ImportsRepository(db);
  }

  register(importer: Importer) {
    this.registry.set(importer.template, importer);
  }

  registerMany(importers: Importer[]) {
    for (const i of importers) this.register(i);
  }

  detect(sheets: ParsedSheet[]): ImportTemplate | null {
    for (const importer of this.registry.values()) {
      if (importer.detect(sheets)) return importer.template;
    }
    return null;
  }

  /**
   * Stage 1: Upload + preview.
   *
   * 1. Parse the workbook.
   * 2. If template is 'auto', try to detect.
   * 3. Run the importer's prepare() to validate every row.
   * 4. Persist a new import_run + all import_run_rows.
   */
  async preview(input: {
    file: ArrayBuffer | Buffer;
    filename: string;
    storage_path: string;
    template?: ImportTemplate | 'auto';
  }): Promise<{ run: ImportRun; rows: PreparedRow[] }> {
    const wb = readWorkbookFromBuffer(input.file);
    const sheets = parseAllSheets(wb);
    if (sheets.length === 0) throw new Error('الملف فارغ أو بدون بيانات صالحة');

    let template: ImportTemplate | null = null;
    if (!input.template || input.template === 'auto') {
      template = this.detect(sheets);
      if (!template) {
        throw new Error('تعذر التعرف على نوع الملف. يرجى تحديد القالب يدوياً.');
      }
    } else {
      template = input.template;
    }

    const importer = this.registry.get(template);
    if (!importer) throw new Error(`لا يوجد مستورد مسجل للقالب: ${template}`);

    const prepared = await importer.prepare(sheets, { db: this.db });

    const run = await this.imports.createRun({
      template_type: template,
      source_filename: input.filename,
      source_path: input.storage_path,
      total_rows: prepared.length,
    });

    await this.imports.insertRows(
      prepared.map((p) => ({
        run_id: run.id,
        row_number: p.row_number,
        raw_data: p.raw,
        resolved_data: p.resolved,
        validation_errors: p.errors as unknown as Json,
        action: p.action,
        target_table: p.target_table,
      }))
    );

    return { run, rows: prepared };
  }

  /**
   * Stage 2: Commit. Walks every row of the run that has action != 'error'
   * and runs its `apply`. If a row throws, the run is marked failed.
   *
   * Note: Supabase JS lacks true cross-statement transactions; we simulate
   * with a sentinel error_message + status. The DB-level constraints provide
   * row-level safety. For atomicity we'd need to lift commit into a Postgres
   * function — Phase 3 will introduce that pattern for jobs/invoices.
   */
  async commit(runId: string, importer: Importer): Promise<{
    inserted: number;
    updated: number;
    skipped: number;
    failed: number;
    failures: Array<{ row_number: number; message: string }>;
  }> {
    const rows = await this.imports.listRows(runId);
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const failures: Array<{ row_number: number; message: string }> = [];

    // We rebuild the apply closures because closures don't survive the
    // round-trip through DB storage. The importer.prepare() must be
    // deterministic given the same source rows.
    const sheets = await this.recoverSheetsFromRows(rows);
    const prepared = await importer.prepare(sheets, { db: this.db });
    const byRowNum = new Map(prepared.map((p) => [p.row_number, p]));

    for (const row of rows) {
      const p = byRowNum.get(row.row_number);
      if (!p) {
        // Source row missing — defensive
        skipped += 1;
        continue;
      }
      if (row.action === 'error' || p.action === 'error') {
        failed += 1;
        continue;
      }
      if (row.action === 'skip' || p.action === 'skip' || !p.apply) {
        skipped += 1;
        continue;
      }
      try {
        const { id } = await p.apply(this.db);
        await this.imports.updateRowAfterCommit(row.id, id);
        if (row.action === 'update') updated += 1;
        else inserted += 1;
      } catch (e) {
        failed += 1;
        failures.push({ row_number: row.row_number, message: (e as Error).message });
      }
    }

    const status: 'committed' | 'failed' = failed > 0 && inserted + updated === 0 ? 'failed' : 'committed';
    await this.imports.finishRun(runId, { inserted, updated, skipped, failed }, status);

    return { inserted, updated, skipped, failed, failures };
  }

  /**
   * Reconstruct ParsedSheet[] from the persisted raw_data of an existing run.
   * Allows the commit step to recompute apply() closures without re-uploading.
   */
  private async recoverSheetsFromRows(rows: ImportRunRow[]): Promise<ParsedSheet[]> {
    if (rows.length === 0) return [];
    // Each raw_data row was stored as { __sheet: name, ...cells }
    const bySheet = new Map<string, ParsedRow[]>();
    let allHeaders = new Set<string>();
    for (const r of rows) {
      const data = r.raw_data as Record<string, any>;
      const sheet = (data.__sheet as string) || 'Sheet1';
      const cells = { ...data };
      delete cells.__sheet;
      Object.keys(cells).forEach((k) => allHeaders.add(k));
      const list = bySheet.get(sheet) ?? [];
      list.push({ row_number: r.row_number, cells });
      bySheet.set(sheet, list);
    }
    const headers = Array.from(allHeaders);
    return Array.from(bySheet.entries()).map(([sheet_name, rows]) => ({
      sheet_name,
      headers,
      raw_headers: headers,
      rows: rows.sort((a, b) => a.row_number - b.row_number),
    }));
  }

  async cancel(runId: string): Promise<void> {
    await this.imports.finishRun(runId, { inserted: 0, updated: 0, skipped: 0, failed: 0 }, 'cancelled');
  }

  /** Re-export the parseSheet used by importers, in case someone needs it. */
  static parseSheet = parseSheet;
}

/**
 * Helper used by every importer to embed the source sheet name in raw_data,
 * so recoverSheetsFromRows can rebuild ParsedSheet[] later.
 */
export function rawWithSheet(sheet_name: string, cells: Record<string, any>): Json {
  return { __sheet: sheet_name, ...cells } as Json;
}
