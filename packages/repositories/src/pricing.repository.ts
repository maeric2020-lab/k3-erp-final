import type { K3SupabaseClient, Database, Tables } from '@k3/shared-types';
import { CrudRepository } from './_base';

export type ServicePricing = Tables<'service_pricing'>;
export type ContractPricing = Tables<'contract_pricing'>;

export class ServicePricingRepository extends CrudRepository<'service_pricing'> {
  constructor(db: K3SupabaseClient) {
    super(db, 'service_pricing', []);
  }

  async listWithJoins(opts: { search?: string; service_id?: string; machine_category_id?: string; active_only?: boolean; limit?: number; offset?: number } = {}) {
    let q = this.db
      .from('service_pricing')
      .select(`
        *,
        service:services_master!inner (id, service_code, name_ar, name_en),
        machine_category:machine_categories (id, code, name_ar, name_en)
      `);
    if (opts.active_only) q = q.eq('is_active', true);
    if (opts.service_id) q = q.eq('service_id', opts.service_id);
    if (opts.machine_category_id === null) q = q.is('machine_category_id', null);
    else if (opts.machine_category_id) q = q.eq('machine_category_id', opts.machine_category_id);
    q = q.order('created_at', { ascending: false });
    if (opts.limit) q = q.limit(opts.limit);
    if (typeof opts.offset === 'number' && opts.limit) q = q.range(opts.offset, opts.offset + opts.limit - 1);
    const { data, error } = await q;
    if (error) throw new Error(`listWithJoins failed: ${error.message}`);
    return data ?? [];
  }

  /**
   * Find the best matching service_pricing row for a (service, machine_category)
   * pair, falling back to the universal row (machine_category_id IS NULL).
   * The compute_line_pricing function will use the same logic.
   */
  async findForServiceAndCategory(serviceId: string, machineCategoryId: string | null): Promise<ServicePricing | null> {
    if (machineCategoryId) {
      const { data: specific, error } = await this.db
        .from('service_pricing')
        .select('*')
        .eq('service_id', serviceId)
        .eq('machine_category_id', machineCategoryId)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw new Error(`findForServiceAndCategory failed: ${error.message}`);
      if (specific) return specific;
    }
    const { data: universal, error } = await this.db
      .from('service_pricing')
      .select('*')
      .eq('service_id', serviceId)
      .is('machine_category_id', null)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw new Error(`findForServiceAndCategory (universal) failed: ${error.message}`);
    return universal;
  }
}

export class ContractPricingRepository extends CrudRepository<'contract_pricing'> {
  constructor(db: K3SupabaseClient) {
    super(db, 'contract_pricing', ['outdoor_model', 'indoor_model']);
  }

  async listWithJoins(opts: { search?: string; machine_category_id?: string; brand_id?: string; refrigerant_id?: string; active_only?: boolean; limit?: number; offset?: number } = {}) {
    let q = this.db
      .from('contract_pricing')
      .select(`
        *,
        machine_category:machine_categories!inner (id, code, name_ar, name_en),
        brand:machine_brands (id, name),
        refrigerant:refrigerant_types (id, code, name)
      `);
    if (opts.active_only) q = q.eq('is_active', true);
    if (opts.machine_category_id) q = q.eq('machine_category_id', opts.machine_category_id);
    if (opts.brand_id) q = q.eq('brand_id', opts.brand_id);
    if (opts.refrigerant_id) q = q.eq('refrigerant_id', opts.refrigerant_id);
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
   * Find by full business key. Used for contract building (when adding a unit)
   * and by the contract-pricing import for duplicate detection.
   */
  async findByBusinessKey(input: {
    machine_category_id: string;
    brand_id: string | null;
    refrigerant_id: string | null;
    outdoor_model: string | null;
    indoor_model: string | null;
    capacity_hp: number | null;
  }): Promise<ContractPricing | null> {
    let q = this.db.from('contract_pricing').select('*').eq('machine_category_id', input.machine_category_id);
    q = input.brand_id ? q.eq('brand_id', input.brand_id) : q.is('brand_id', null);
    q = input.refrigerant_id ? q.eq('refrigerant_id', input.refrigerant_id) : q.is('refrigerant_id', null);
    q = input.outdoor_model ? q.eq('outdoor_model', input.outdoor_model) : q.is('outdoor_model', null);
    q = input.indoor_model ? q.eq('indoor_model', input.indoor_model) : q.is('indoor_model', null);
    q = input.capacity_hp != null ? q.eq('capacity_hp', input.capacity_hp) : q.is('capacity_hp', null);
    const { data, error } = await q.maybeSingle();
    if (error) throw new Error(`findByBusinessKey failed: ${error.message}`);
    return data;
  }
}
