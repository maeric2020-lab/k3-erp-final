import type { K3SupabaseClient, Database, Tables } from '@k3/shared-types';
import { CrudRepository, type ListOptions } from './_base';

export type Quotation = Tables<'quotations'>;
export type Invoice = Tables<'invoices'>;
export type Payment = Tables<'payments'>;
export type ContractClauseTemplate = Tables<'contract_clause_templates'>;
export type ContractClause = Tables<'contract_clauses'>;
export type CompressorBracket = Tables<'compressor_install_brackets'>;

// -----------------------------------------------------------------------------
// QuotationsRepository
// -----------------------------------------------------------------------------
export class QuotationsRepository extends CrudRepository<'quotations'> {
  constructor(db: K3SupabaseClient) {
    super(db, 'quotations', ['quotation_no', 'notes']);
  }

  async listForCustomer(customerId: string): Promise<Quotation[]> {
    const { data, error } = await this.db
      .from('quotations')
      .select('*')
      .eq('customer_id', customerId)
      .order('issue_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async getByQuotationNo(no: string): Promise<Quotation | null> {
    const { data, error } = await this.db.from('quotations').select('*').eq('quotation_no', no).maybeSingle();
    if (error) throw error;
    return data;
  }
}

// -----------------------------------------------------------------------------
// InvoicesRepository
// -----------------------------------------------------------------------------
export class InvoicesRepository extends CrudRepository<'invoices'> {
  constructor(db: K3SupabaseClient) {
    super(db, 'invoices', ['invoice_no', 'notes']);
  }

  async listForCustomer(customerId: string): Promise<Invoice[]> {
    const { data, error } = await this.db
      .from('invoices')
      .select('*')
      .eq('customer_id', customerId)
      .order('issue_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async listByStatus(statuses: string[], opts: ListOptions = {}): Promise<Invoice[]> {
    let q = this.db.from('invoices').select('*').in('status', statuses);
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q.order('issue_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async listOutstanding(opts: ListOptions = {}): Promise<Invoice[]> {
    let q = this.db.from('invoices').select('*').in('status', ['issued', 'partial']);
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q.order('issue_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async getByJobId(jobId: string): Promise<Invoice | null> {
    const { data, error } = await this.db.from('invoices').select('*').eq('job_id', jobId).maybeSingle();
    if (error) throw error;
    return data;
  }
}

// -----------------------------------------------------------------------------
// PaymentsRepository
// -----------------------------------------------------------------------------
export class PaymentsRepository extends CrudRepository<'payments'> {
  constructor(db: K3SupabaseClient) {
    super(db, 'payments', ['payment_no', 'reference', 'notes']);
  }

  async listForInvoice(invoiceId: string): Promise<Payment[]> {
    const { data, error } = await this.db
      .from('payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('payment_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async listForCustomer(customerId: string): Promise<Payment[]> {
    const { data, error } = await this.db
      .from('payments')
      .select('*')
      .eq('customer_id', customerId)
      .order('payment_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }
}

// -----------------------------------------------------------------------------
// ContractClauseTemplatesRepository
// -----------------------------------------------------------------------------
export class ContractClauseTemplatesRepository extends CrudRepository<'contract_clause_templates'> {
  constructor(db: K3SupabaseClient) {
    super(db, 'contract_clause_templates', ['code', 'title_ar', 'title_en']);
  }

  async listOrdered(): Promise<ContractClauseTemplate[]> {
    const { data, error } = await this.db
      .from('contract_clause_templates')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async getByCode(code: string): Promise<ContractClauseTemplate | null> {
    const { data, error } = await this.db
      .from('contract_clause_templates')
      .select('*')
      .eq('code', code)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
}

// -----------------------------------------------------------------------------
// ContractClausesRepository — per-contract clauses
// -----------------------------------------------------------------------------
export class ContractClausesRepository extends CrudRepository<'contract_clauses'> {
  constructor(db: K3SupabaseClient) {
    super(db, 'contract_clauses', ['code', 'title_ar']);
  }

  async listForContract(contractId: string): Promise<ContractClause[]> {
    const { data, error } = await this.db
      .from('contract_clauses')
      .select('*')
      .eq('contract_id', contractId)
      .order('display_order', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async deleteForContract(contractId: string): Promise<void> {
    const { error } = await this.db.from('contract_clauses').delete().eq('contract_id', contractId);
    if (error) throw error;
  }
}

// -----------------------------------------------------------------------------
// CompressorBracketsRepository
// -----------------------------------------------------------------------------
export class CompressorBracketsRepository extends CrudRepository<'compressor_install_brackets'> {
  constructor(db: K3SupabaseClient) {
    super(db, 'compressor_install_brackets', []);
  }

  async listOrdered(): Promise<CompressorBracket[]> {
    const { data, error } = await this.db
      .from('compressor_install_brackets')
      .select('*')
      .eq('is_active', true)
      .order('hp_min', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Wrapper around the fn_compressor_bracket_price RPC.
   */
  async lookupPrice(hp: number, k3Supplied: boolean): Promise<{ bracket_id: string; base_price: number; surcharge_pct: number; total_price: number } | null> {
    const { data, error } = await this.db.rpc('fn_compressor_bracket_price' as any, {
      p_hp: hp,
      p_k3_supplied: k3Supplied,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      bracket_id: row.bracket_id,
      base_price: Number(row.base_price ?? 0),
      surcharge_pct: Number(row.surcharge_pct ?? 0),
      total_price: Number(row.total_price ?? 0),
    };
  }
}
