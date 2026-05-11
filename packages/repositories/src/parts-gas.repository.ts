import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@k3/shared-types';
import { CrudRepository } from './_base';

export type SparePartMaster = Tables<'spare_parts_master'>;
export type GasTypeMaster = Tables<'gas_types_master'>;

export class SparePartsMasterRepository extends CrudRepository<'spare_parts_master'> {
  constructor(db: SupabaseClient<Database>) {
    super(db, 'spare_parts_master', ['part_code', 'name_ar', 'name_en', 'model']);
  }
  protected defaultOrderColumn() { return 'created_at'; }

  async listWithJoins(opts: { search?: string; category_id?: string; active_only?: boolean; limit?: number; offset?: number } = {}) {
    let q = this.db
      .from('spare_parts_master')
      .select(`
        *,
        category:spare_part_categories!inner (id, code, name_ar, name_en),
        brand:machine_brands (id, name)
      `);
    if (opts.active_only) q = q.eq('is_active', true);
    if (opts.category_id) q = q.eq('category_id', opts.category_id);
    if (opts.search) {
      const term = `%${opts.search.trim()}%`;
      q = q.or(`part_code.ilike.${term},name_ar.ilike.${term},name_en.ilike.${term},model.ilike.${term}`);
    }
    q = q.order('created_at', { ascending: false });
    if (opts.limit) q = q.limit(opts.limit);
    if (typeof opts.offset === 'number' && opts.limit) q = q.range(opts.offset, opts.offset + opts.limit - 1);
    const { data, error } = await q;
    if (error) throw new Error(`listWithJoins failed: ${error.message}`);
    return data ?? [];
  }

  async listForMachineCategory(categoryId: string, search?: string): Promise<SparePartMaster[]> {
    let q = this.db
      .from('spare_parts_master')
      .select('*')
      .eq('is_active', true)
      .contains('compatible_categories', [categoryId]);
    if (search) {
      const term = `%${search.trim()}%`;
      q = q.or(`name_ar.ilike.${term},name_en.ilike.${term},model.ilike.${term}`);
    }
    q = q.order('name_en', { ascending: true }).limit(100);
    const { data, error } = await q;
    if (error) throw new Error(`listForMachineCategory failed: ${error.message}`);
    return data ?? [];
  }
}

export class GasTypesMasterRepository extends CrudRepository<'gas_types_master'> {
  constructor(db: SupabaseClient<Database>) {
    super(db, 'gas_types_master', []);
  }
  protected defaultOrderColumn() { return 'created_at'; }

  async listWithRefrigerant(): Promise<Array<GasTypeMaster & { refrigerant: { code: string; name: string } | null }>> {
    const { data, error } = await this.db
      .from('gas_types_master')
      .select(`*, refrigerant:refrigerant_types!inner (code, name)`)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`listWithRefrigerant failed: ${error.message}`);
    return (data ?? []) as any;
  }

  async getByRefrigerantId(refrigerantId: string): Promise<GasTypeMaster | null> {
    const { data, error } = await this.db
      .from('gas_types_master')
      .select('*')
      .eq('refrigerant_id', refrigerantId)
      .maybeSingle();
    if (error) throw new Error(`getByRefrigerantId failed: ${error.message}`);
    return data;
  }
}
