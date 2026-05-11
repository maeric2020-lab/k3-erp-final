import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@k3/shared-types';

type TableName = keyof Database['public']['Tables'];

export interface ListOptions {
  search?: string | null;
  limit?: number;
  offset?: number;
  active_only?: boolean;
  order_by?: string;
  ascending?: boolean;
}

/**
 * Strongly-typed CRUD base class. Each concrete repository specifies its
 * table name and the searchable text columns; standard list/get/create/
 * update/delete operations come for free.
 *
 * Concrete repositories may add custom queries (joins, RPCs, aggregates) on
 * top — that's where business-specific logic lives.
 */
export abstract class CrudRepository<T extends TableName> {
  constructor(
    protected readonly db: SupabaseClient<Database>,
    protected readonly table: T,
    protected readonly searchableColumns: readonly string[] = []
  ) {}

  protected applyListFilters(qb: any, opts: ListOptions): any {
    if (opts.active_only) qb = qb.eq('is_active', true);
    if (opts.search && this.searchableColumns.length > 0) {
      const term = `%${opts.search.trim()}%`;
      const filters = this.searchableColumns.map((c) => `${c}.ilike.${term}`).join(',');
      qb = qb.or(filters);
    }
    const orderCol = opts.order_by ?? this.defaultOrderColumn();
    const asc = opts.ascending ?? true;
    qb = qb.order(orderCol, { ascending: asc });
    if (typeof opts.limit === 'number') qb = qb.limit(opts.limit);
    if (typeof opts.offset === 'number' && typeof opts.limit === 'number') {
      qb = qb.range(opts.offset, opts.offset + opts.limit - 1);
    }
    return qb;
  }

  protected defaultOrderColumn(): string {
    return 'created_at';
  }

  async list(opts: ListOptions = {}): Promise<Database['public']['Tables'][T]['Row'][]> {
    let q = this.db.from(this.table as string).select('*');
    q = this.applyListFilters(q, opts);
    const { data, error } = await q;
    if (error) throw new Error(`[${String(this.table)}] list failed: ${error.message}`);
    return (data ?? []) as Database['public']['Tables'][T]['Row'][];
  }

  async count(opts: ListOptions = {}): Promise<number> {
    let q = this.db.from(this.table as string).select('*', { count: 'exact', head: true });
    q = this.applyListFilters(q, opts);
    const { count, error } = await q;
    if (error) throw new Error(`[${String(this.table)}] count failed: ${error.message}`);
    return count ?? 0;
  }

  async getById(id: string): Promise<Database['public']['Tables'][T]['Row'] | null> {
    const { data, error } = await this.db
      .from(this.table as string)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`[${String(this.table)}] getById failed: ${error.message}`);
    return data as any;
  }

  async create(input: Database['public']['Tables'][T]['Insert']): Promise<Database['public']['Tables'][T]['Row']> {
    const { data, error } = await this.db
      .from(this.table as string)
      .insert(input as any)
      .select('*')
      .single();
    if (error) throw new Error(`[${String(this.table)}] create failed: ${error.message}`);
    return data as any;
  }

  async update(id: string, patch: Database['public']['Tables'][T]['Update']): Promise<Database['public']['Tables'][T]['Row']> {
    const { data, error } = await this.db
      .from(this.table as string)
      .update(patch as any)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(`[${String(this.table)}] update failed: ${error.message}`);
    return data as any;
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await this.db
      .from(this.table as string)
      .update({ is_active: false } as any)
      .eq('id', id);
    if (error) throw new Error(`[${String(this.table)}] softDelete failed: ${error.message}`);
  }

  async hardDelete(id: string): Promise<void> {
    const { error } = await this.db.from(this.table as string).delete().eq('id', id);
    if (error) throw new Error(`[${String(this.table)}] hardDelete failed: ${error.message}`);
  }
}
