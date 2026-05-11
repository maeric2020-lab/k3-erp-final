import * as XLSX from 'xlsx';

/**
 * Excel parsing helpers used by the import service.
 *
 * All importers convert spreadsheet content into a uniform shape:
 *   { sheetName: string; headers: string[]; rows: ParsedRow[] }
 * where each row is { row_number, cells: Record<header, value> }.
 *
 * Header normalization: trimmed, collapsed whitespace, lowercased. The
 * header-to-canonical mapping happens per-importer.
 */

export type CellValue = string | number | boolean | null;

export interface ParsedRow {
  row_number: number; // 1-indexed source spreadsheet row (after header)
  cells: Record<string, CellValue>;
}

export interface ParsedSheet {
  sheet_name: string;
  headers: string[]; // normalized
  raw_headers: string[]; // original
  rows: ParsedRow[];
}

export function normalizeHeader(s: string): string {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function readWorkbookFromBuffer(buf: ArrayBuffer | Buffer): XLSX.WorkBook {
  const data = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  return XLSX.read(data, { type: 'array', cellDates: true });
}

/**
 * Parse a single sheet. The first non-empty row is treated as the header row.
 * Empty rows (all cells null/empty) are dropped.
 */
export function parseSheet(wb: XLSX.WorkBook, sheetName?: string): ParsedSheet {
  const targetName = sheetName ?? wb.SheetNames[0];
  if (!targetName) throw new Error('Workbook contains no sheets');
  const ws = wb.Sheets[targetName];
  if (!ws) throw new Error(`Sheet not found: ${targetName}`);

  // sheet_to_json with header:1 returns array-of-arrays; defval keeps blank cells
  const aoa = XLSX.utils.sheet_to_json<CellValue[]>(ws, { header: 1, defval: null, raw: true });
  if (aoa.length === 0) {
    return { sheet_name: targetName, headers: [], raw_headers: [], rows: [] };
  }

  // Find first row with at least one non-empty cell — that's our header
  let headerRowIdx = -1;
  for (let i = 0; i < aoa.length; i++) {
    if (aoa[i].some((c) => c !== null && c !== undefined && String(c).trim() !== '')) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx < 0) return { sheet_name: targetName, headers: [], raw_headers: [], rows: [] };

  const rawHeaders = aoa[headerRowIdx].map((h) => (h == null ? '' : String(h)));
  const headers = rawHeaders.map(normalizeHeader);

  const rows: ParsedRow[] = [];
  for (let i = headerRowIdx + 1; i < aoa.length; i++) {
    const r = aoa[i];
    if (!r || r.every((c) => c === null || c === undefined || String(c).trim() === '')) continue;
    const cells: Record<string, CellValue> = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      if (!key) continue;
      const v = r[j];
      cells[key] = v === undefined ? null : v;
    }
    rows.push({ row_number: i + 1, cells });
  }

  return { sheet_name: targetName, headers, raw_headers: rawHeaders, rows };
}

/** Convenience: parse all non-empty sheets in a workbook */
export function parseAllSheets(wb: XLSX.WorkBook): ParsedSheet[] {
  return wb.SheetNames.map((name) => parseSheet(wb, name)).filter((s) => s.rows.length > 0);
}

// -----------------------------------------------------------------------------
// Cell coercion helpers
// -----------------------------------------------------------------------------
export function asString(v: CellValue): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

export function asNumber(v: CellValue): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (s === '' || s === '-') return null;
  const cleaned = s.replace(/,/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function asBoolean(v: CellValue): boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (['true', 'yes', '1', 'y'].includes(s)) return true;
  if (['false', 'no', '0', 'n'].includes(s)) return false;
  return null;
}

/**
 * Recognize the "covered/included" sentinel used in the source pricing Excel.
 * Returns true if the cell means "this is included in the contract" (not a price).
 */
export function isCoveredSentinel(v: CellValue): boolean {
  if (v === null || v === undefined) return false;
  const s = String(v).trim().toLowerCase();
  return ['include', 'included', 'covered', 'مشمول', 'مشمولة', 'مغطى', 'مغطاة'].includes(s);
}

/**
 * Find a header among a list of candidates. Returns the first matching
 * normalized header from `available`, or null if none match.
 */
export function findHeader(available: string[], candidates: string[]): string | null {
  const set = new Set(available);
  for (const c of candidates) {
    const n = normalizeHeader(c);
    if (set.has(n)) return n;
  }
  return null;
}

/**
 * Build an ArrayBuffer for an in-memory workbook (used when generating
 * downloadable templates).
 */
export function workbookToArrayBuffer(wb: XLSX.WorkBook): ArrayBuffer {
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return out as ArrayBuffer;
}

export { XLSX };
