import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@k3/shared-types';
import { CrudRepository } from './_base';

export type Customer = Tables<'customers'>;
export type CustomerSite = Tables<'customer_sites'>;

export class CustomersRepository extends CrudRepository<'customers'> {
  constructor(db: SupabaseClient<Database>) {
    super(db, 'customers', ['name_ar', 'name_en', 'phone_primary', 'phone_secondary', 'civil_id', 'code']);
  }
  protected defaultOrderColumn() { return 'created_at'; }

  async getByCode(code: string): Promise<Customer | null> {
    const { data, error } = await this.db.from('customers').select('*').eq('code', code).maybeSingle();
    if (error) throw new Error(`getByCode failed: ${error.message}`);
    return data;
  }

  /** Customer + their sites (single round-trip) */
  async getWithSites(id: string): Promise<{ customer: Customer; sites: CustomerSite[] } | null> {
    const customer = await this.getById(id);
    if (!customer) return null;
    const { data: sites, error } = await this.db
      .from('customer_sites')
      .select('*')
      .eq('customer_id', id)
      .eq('is_active', true)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) throw new Error(`getWithSites failed: ${error.message}`);
    return { customer, sites: sites ?? [] };
  }
}

export class CustomerSitesRepository extends CrudRepository<'customer_sites'> {
  constructor(db: SupabaseClient<Database>) {
    super(db, 'customer_sites', ['site_name', 'area', 'block', 'street', 'building']);
  }
  protected defaultOrderColumn() { return 'created_at'; }

  async listForCustomer(customerId: string): Promise<CustomerSite[]> {
    const { data, error } = await this.db
      .from('customer_sites')
      .select('*')
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) throw new Error(`listForCustomer failed: ${error.message}`);
    return data ?? [];
  }
}
