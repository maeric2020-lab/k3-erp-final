import type { K3SupabaseClient, Database, Json, Tables } from '@k3/shared-types';

export type ImportRun = Tables<'import_runs'>;
export type ImportRunRow = Tables<'import_run_rows'>;

export class ImportsRepository {
  constructor(private readonly db: K3SupabaseClient) {}

  async createRun(input: {
    template_type: string;
    source_filename: string;
    source_path: string;
    total_rows: number;
  }): Promise<ImportRun> {
    const { data, error } = await this.db
      .from('import_runs')
      .insert({
        template_type: input.template_type,
        source_filename: input.source_filename,
        source_path: input.source_path,
        total_rows: input.total_rows,
        status: 'previewing',
      })
      .select('*')
      .single();
    if (error) throw new Error(`createRun failed: ${error.message}`);
    return data;
  }

  async listRows(runId: string): Promise<ImportRunRow[]> {
    const { data, error } = await this.db
      .from('import_run_rows')
      .select('*')
      .eq('run_id', runId)
      .order('row_number', { ascending: true });
    if (error) throw new Error(`listRows failed: ${error.message}`);
    return data ?? [];
  }

  async insertRows(rows: Array<{
    run_id: string;
    row_number: number;
    raw_data: Json;
    resolved_data: Json | null;
    validation_errors: Json;
    action: 'pending' | 'insert' | 'update' | 'skip' | 'error';
    target_table: string | null;
  }>): Promise<void> {
    if (rows.length === 0) return;
    // Insert in chunks of 500
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await this.db.from('import_run_rows').insert(chunk as any);
      if (error) throw new Error(`insertRows failed (chunk ${i}): ${error.message}`);
    }
  }

  async updateRowAfterCommit(rowId: string, targetId: string): Promise<void> {
    const { error } = await this.db
      .from('import_run_rows')
      .update({ target_id: targetId })
      .eq('id', rowId);
    if (error) throw new Error(`updateRowAfterCommit failed: ${error.message}`);
  }

  async finishRun(
    runId: string,
    counts: { inserted: number; updated: number; skipped: number; failed: number },
    status: 'committed' | 'failed' | 'cancelled' = 'committed',
    errorMessage: string | null = null
  ): Promise<void> {
    const { error } = await this.db
      .from('import_runs')
      .update({
        inserted_rows: counts.inserted,
        updated_rows: counts.updated,
        skipped_rows: counts.skipped,
        failed_rows: counts.failed,
        status,
        error_message: errorMessage,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId);
    if (error) throw new Error(`finishRun failed: ${error.message}`);
  }

  async listRuns(opts: { template_type?: string; uploaded_by?: string; limit?: number } = {}): Promise<ImportRun[]> {
    let q = this.db.from('import_runs').select('*').order('started_at', { ascending: false });
    if (opts.template_type) q = q.eq('template_type', opts.template_type);
    if (opts.uploaded_by) q = q.eq('uploaded_by', opts.uploaded_by);
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) throw new Error(`listRuns failed: ${error.message}`);
    return data ?? [];
  }

  async getRun(runId: string): Promise<ImportRun | null> {
    const { data, error } = await this.db.from('import_runs').select('*').eq('id', runId).maybeSingle();
    if (error) throw new Error(`getRun failed: ${error.message}`);
    return data;
  }
}
