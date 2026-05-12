import type { K3SupabaseClient, Database, Tables } from '@k3/shared-types';
import { CrudRepository } from './_base';

export type ServiceCategory = Tables<'service_categories'>;
export type ServiceType = Tables<'service_types'>;
export type SparePartCategory = Tables<'spare_part_categories'>;
export type ServiceMaster = Tables<'services_master'>;

export class ServiceCategoriesRepository extends CrudRepository<'service_categories'> {
  constructor(db: K3SupabaseClient) {
    super(db, 'service_categories', ['code', 'name_ar', 'name_en']);
  }
  protected defaultOrderColumn() { return 'display_order'; }

  async getByCode(code: string): Promise<ServiceCategory | null> {
    const { data, error } = await this.db.from('service_categories').select('*').eq('code', code).maybeSingle();
    if (error) throw new Error(`getByCode failed: ${error.message}`);
    return data;
  }
}

export class ServiceTypesRepository extends CrudRepository<'service_types'> {
  constructor(db: K3SupabaseClient) {
    super(db, 'service_types', ['code', 'name_ar', 'name_en']);
  }
  protected defaultOrderColumn() { return 'display_order'; }

  async getByCode(code: string): Promise<ServiceType | null> {
    const { data, error } = await this.db.from('service_types').select('*').eq('code', code).maybeSingle();
    if (error) throw new Error(`getByCode failed: ${error.message}`);
    return data;
  }

  /**
   * Find or create by name within a category. Used by the service import to
   * auto-create types discovered in source data without breaking RLS — the
   * caller's user must have service_types:add permission.
   */
  async findOrCreateByName(categoryId: string, nameEn: string, nameAr: string): Promise<ServiceType> {
    const trimmedEn = nameEn.trim();
    const trimmedAr = nameAr.trim();
    // Match on case-insensitive English name first
    const { data: existing } = await this.db
      .from('service_types')
      .select('*')
      .eq('category_id', categoryId)
      .ilike('name_en', trimmedEn)
      .maybeSingle();
    if (existing) return existing;

    // Auto-derive a code from the English name (uppercase, replace non-alnum with _)
    const code = trimmedEn
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64);

    return this.create({
      category_id: categoryId,
      code: code || `SVC_TYPE_${Date.now().toString(36).toUpperCase()}`,
      name_ar: trimmedAr || trimmedEn,
      name_en: trimmedEn,
    });
  }
}

export class SparePartCategoriesRepository extends CrudRepository<'spare_part_categories'> {
  constructor(db: K3SupabaseClient) {
    super(db, 'spare_part_categories', ['code', 'name_ar', 'name_en']);
  }
  protected defaultOrderColumn() { return 'display_order'; }

  async getByCode(code: string): Promise<SparePartCategory | null> {
    const { data, error } = await this.db
      .from('spare_part_categories')
      .select('*')
      .eq('code', code)
      .maybeSingle();
    if (error) throw new Error(`getByCode failed: ${error.message}`);
    return data;
  }
}

export class ServicesMasterRepository extends CrudRepository<'services_master'> {
  constructor(db: K3SupabaseClient) {
    super(db, 'services_master', ['service_code', 'name_ar', 'name_en', 'technical_code']);
  }
  protected defaultOrderColumn() { return 'created_at'; }

  /** List with the service_type and category joined for display tables. */
  async listWithJoins(opts: { search?: string; service_type_id?: string; active_only?: boolean; limit?: number; offset?: number } = {}) {
    let q = this.db
      .from('services_master')
      .select(`
        *,
        service_type:service_types!inner (
          id, code, name_ar, name_en,
          category:service_categories!inner (id, code, name_ar, name_en)
        ),
        default_part_category:spare_part_categories (id, code, name_ar, name_en)
      `);
    if (opts.active_only) q = q.eq('is_active', true);
    if (opts.service_type_id) q = q.eq('service_type_id', opts.service_type_id);
    if (opts.search) {
      const term = `%${opts.search.trim()}%`;
      q = q.or(`service_code.ilike.${term},name_ar.ilike.${term},name_en.ilike.${term},technical_code.ilike.${term}`);
    }
    q = q.order('created_at', { ascending: false });
    if (opts.limit) q = q.limit(opts.limit);
    if (typeof opts.offset === 'number' && opts.limit) q = q.range(opts.offset, opts.offset + opts.limit - 1);
    const { data, error } = await q;
    if (error) throw new Error(`listWithJoins failed: ${error.message}`);
    return data ?? [];
  }

  /**
   * Find an existing service by exact English-name match within a service type.
   * Used by the service import to detect duplicates.
   */
  async findByName(serviceTypeId: string, nameEn: string): Promise<ServiceMaster | null> {
    const { data, error } = await this.db
      .from('services_master')
      .select('*')
      .eq('service_type_id', serviceTypeId)
      .ilike('name_en', nameEn.trim())
      .maybeSingle();
    if (error) throw new Error(`findByName failed: ${error.message}`);
    return data;
  }
}
