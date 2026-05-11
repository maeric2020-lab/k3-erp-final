import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@k3/shared-types';
import { CrudRepository } from './_base';

export type MachineCategory = Tables<'machine_categories'>;
export type MachineBrand = Tables<'machine_brands'>;
export type RefrigerantType = Tables<'refrigerant_types'>;
export type MachineMaster = Tables<'machines_master'>;

export class MachineCategoriesRepository extends CrudRepository<'machine_categories'> {
  constructor(db: SupabaseClient<Database>) {
    super(db, 'machine_categories', ['code', 'name_ar', 'name_en']);
  }
  protected defaultOrderColumn() { return 'display_order'; }

  async getByCode(code: string): Promise<MachineCategory | null> {
    const { data, error } = await this.db.from('machine_categories').select('*').eq('code', code).maybeSingle();
    if (error) throw new Error(`getByCode failed: ${error.message}`);
    return data;
  }
}

export class MachineBrandsRepository extends CrudRepository<'machine_brands'> {
  constructor(db: SupabaseClient<Database>) {
    super(db, 'machine_brands', ['name', 'country_origin']);
  }
  protected defaultOrderColumn() { return 'name'; }

  async getByName(name: string): Promise<MachineBrand | null> {
    const { data, error } = await this.db.from('machine_brands').select('*').ilike('name', name).maybeSingle();
    if (error) throw new Error(`getByName failed: ${error.message}`);
    return data;
  }
}

export class RefrigerantTypesRepository extends CrudRepository<'refrigerant_types'> {
  constructor(db: SupabaseClient<Database>) {
    super(db, 'refrigerant_types', ['code', 'name']);
  }
  protected defaultOrderColumn() { return 'code'; }

  async getByCode(code: string): Promise<RefrigerantType | null> {
    const { data, error } = await this.db
      .from('refrigerant_types')
      .select('*')
      .ilike('code', code.trim())
      .maybeSingle();
    if (error) throw new Error(`getByCode failed: ${error.message}`);
    return data;
  }
}

export class MachinesMasterRepository extends CrudRepository<'machines_master'> {
  constructor(db: SupabaseClient<Database>) {
    super(db, 'machines_master', ['outdoor_model', 'indoor_model']);
  }
  protected defaultOrderColumn() { return 'created_at'; }

  /** List with category/brand/refrigerant joined. */
  async listWithJoins(opts: { search?: string; category_id?: string; active_only?: boolean; limit?: number; offset?: number } = {}) {
    let q = this.db
      .from('machines_master')
      .select(`
        *,
        category:machine_categories!inner (id, code, name_ar, name_en),
        brand:machine_brands (id, name),
        refrigerant:refrigerant_types (id, code, name)
      `);
    if (opts.active_only) q = q.eq('is_active', true);
    if (opts.category_id) q = q.eq('category_id', opts.category_id);
    if (opts.search) {
      const term = `%${opts.search.trim()}%`;
      q = q.or(`outdoor_model.ilike.${term},indoor_model.ilike.${term}`);
    }
    q = q.order('created_at', { ascending: false });
    if (opts.limit) q = q.limit(opts.limit);
    if (typeof opts.offset === 'number' && opts.limit) q = q.range(opts.offset, opts.offset + opts.limit - 1);
    const { data, error } = await q;
    if (error) throw new Error(`listWithJoins failed: ${error.message}`);
    return data ?? [];
  }

  /**
   * Look up a machine by its business identity (category + brand + outdoor + indoor + refrigerant).
   * Used by the contract pricing import to detect duplicates and by the line picker.
   */
  async findByBusinessKey(input: {
    category_id: string;
    brand_id: string | null;
    refrigerant_id: string | null;
    outdoor_model: string | null;
    indoor_model: string | null;
  }): Promise<MachineMaster | null> {
    let q = this.db.from('machines_master').select('*').eq('category_id', input.category_id);
    q = input.brand_id ? q.eq('brand_id', input.brand_id) : q.is('brand_id', null);
    q = input.refrigerant_id ? q.eq('refrigerant_id', input.refrigerant_id) : q.is('refrigerant_id', null);
    q = input.outdoor_model ? q.eq('outdoor_model', input.outdoor_model) : q.is('outdoor_model', null);
    q = input.indoor_model ? q.eq('indoor_model', input.indoor_model) : q.is('indoor_model', null);
    const { data, error } = await q.maybeSingle();
    if (error) throw new Error(`findByBusinessKey failed: ${error.message}`);
    return data;
  }
}
