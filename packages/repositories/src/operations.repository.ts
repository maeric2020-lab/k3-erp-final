import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables, LineType } from '@k3/shared-types';
import { CrudRepository, type ListOptions } from './_base';

export type CustomerMachine = Tables<'customer_machines'>;
export type Contract = Tables<'contracts'>;
export type ContractMachine = Tables<'contract_machines'>;
export type MaintenanceRequest = Tables<'maintenance_requests'>;
export type Job = Tables<'jobs'>;
export type DocumentLine = Tables<'document_lines'>;

// -----------------------------------------------------------------------------
// CustomerMachinesRepository
// -----------------------------------------------------------------------------
export class CustomerMachinesRepository extends CrudRepository<'customer_machines'> {
  constructor(db: SupabaseClient<Database>) {
    super(db, 'customer_machines', ['outdoor_model', 'indoor_model', 'serial_number']);
  }

  async listForCustomer(customerId: string): Promise<CustomerMachine[]> {
    const { data, error } = await this.db
      .from('customer_machines')
      .select('*')
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async listForSite(siteId: string): Promise<CustomerMachine[]> {
    const { data, error } = await this.db
      .from('customer_machines')
      .select('*')
      .eq('site_id', siteId)
      .eq('is_active', true);
    if (error) throw error;
    return data ?? [];
  }
}

// -----------------------------------------------------------------------------
// ContractsRepository
// -----------------------------------------------------------------------------
export class ContractsRepository extends CrudRepository<'contracts'> {
  constructor(db: SupabaseClient<Database>) {
    super(db, 'contracts', ['contract_no', 'notes']);
  }

  async listForCustomer(customerId: string): Promise<Contract[]> {
    const { data, error } = await this.db
      .from('contracts')
      .select('*')
      .eq('customer_id', customerId)
      .order('start_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async listActive(opts: ListOptions = {}): Promise<Contract[]> {
    let q = this.db.from('contracts').select('*').in('status', ['active', 'draft']);
    if (opts.limit) q = q.limit(opts.limit);
    if (opts.offset) q = q.range(opts.offset, (opts.offset + (opts.limit ?? 50)) - 1);
    const { data, error } = await q.order('start_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async getByContractNo(contractNo: string): Promise<Contract | null> {
    const { data, error } = await this.db
      .from('contracts')
      .select('*')
      .eq('contract_no', contractNo)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
}

// -----------------------------------------------------------------------------
// ContractMachinesRepository
// -----------------------------------------------------------------------------
export class ContractMachinesRepository extends CrudRepository<'contract_machines'> {
  constructor(db: SupabaseClient<Database>) {
    super(db, 'contract_machines', []);
  }

  async listForContract(contractId: string): Promise<ContractMachine[]> {
    const { data, error } = await this.db
      .from('contract_machines')
      .select('*')
      .eq('contract_id', contractId);
    if (error) throw error;
    return data ?? [];
  }

  async findByContractAndMachine(contractId: string, machineId: string): Promise<ContractMachine | null> {
    const { data, error } = await this.db
      .from('contract_machines')
      .select('*')
      .eq('contract_id', contractId)
      .eq('customer_machine_id', machineId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
}

// -----------------------------------------------------------------------------
// MaintenanceRequestsRepository
// -----------------------------------------------------------------------------
export class MaintenanceRequestsRepository extends CrudRepository<'maintenance_requests'> {
  constructor(db: SupabaseClient<Database>) {
    super(db, 'maintenance_requests', ['request_no', 'reported_by', 'reported_phone', 'notes']);
  }

  async getByRequestNo(requestNo: string): Promise<MaintenanceRequest | null> {
    const { data, error } = await this.db
      .from('maintenance_requests')
      .select('*')
      .eq('request_no', requestNo)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async listOpen(opts: ListOptions = {}): Promise<MaintenanceRequest[]> {
    let q = this.db.from('maintenance_requests').select('*').in('status', ['open', 'in_progress']);
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }
}

// -----------------------------------------------------------------------------
// JobsRepository — adds technician-scoped queries and step advancement
// -----------------------------------------------------------------------------
export type JobStep =
  | 'accept' | 'on_way' | 'arrived' | 'start_inspection'
  | 'start_work' | 'mark_complete' | 'submit_signatures' | 'cancel';

const STEP_TO_STATUS: Record<JobStep, string> = {
  accept: 'accepted',
  on_way: 'on_way',
  arrived: 'arrived',
  start_inspection: 'inspection_started',
  start_work: 'work_started',
  mark_complete: 'report_pending',
  submit_signatures: 'completed',
  cancel: 'cancelled',
};

export class JobsRepository extends CrudRepository<'jobs'> {
  constructor(db: SupabaseClient<Database>) {
    super(db, 'jobs', ['job_no', 'technician_notes', 'inspection_notes']);
  }

  async getByJobNo(jobNo: string): Promise<Job | null> {
    const { data, error } = await this.db.from('jobs').select('*').eq('job_no', jobNo).maybeSingle();
    if (error) throw error;
    return data;
  }

  /**
   * List jobs assigned to a specific technician. Used by /my-jobs (the mobile
   * technician view) — RLS already filters to own jobs, but we filter
   * explicitly anyway so the query is fast.
   */
  async listForTechnician(technicianId: string, opts: ListOptions = {}): Promise<Job[]> {
    let q = this.db.from('jobs').select('*').eq('technician_id', technicianId);
    if (opts.active_only) q = q.not('status', 'in', '(closed,cancelled)');
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async listByStatus(statuses: string[], opts: ListOptions = {}): Promise<Job[]> {
    let q = this.db.from('jobs').select('*').in('status', statuses);
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async listForRequest(requestId: string): Promise<Job[]> {
    const { data, error } = await this.db
      .from('jobs')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Apply a step transition. The DB trigger enforces legal transitions and
   * stamps the appropriate *_at timestamp; this method just packages the
   * patch (status + auxiliary fields like signature paths or GPS).
   */
  async advanceStep(
    jobId: string,
    step: JobStep,
    extras: Partial<Job> = {}
  ): Promise<Job> {
    const newStatus = STEP_TO_STATUS[step];
    const patch: Partial<Job> = { ...extras, status: newStatus as any };
    const { data, error } = await this.db
      .from('jobs')
      .update(patch as any)
      .eq('id', jobId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }
}

// -----------------------------------------------------------------------------
// DocumentLinesRepository
// -----------------------------------------------------------------------------
export class DocumentLinesRepository extends CrudRepository<'document_lines'> {
  constructor(db: SupabaseClient<Database>) {
    super(db, 'document_lines', ['description_ar', 'description_en']);
  }

  async listForJob(jobId: string): Promise<DocumentLine[]> {
    const { data, error } = await this.db
      .from('document_lines')
      .select('*')
      .eq('job_id', jobId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async listForContract(contractId: string): Promise<DocumentLine[]> {
    const { data, error } = await this.db
      .from('document_lines')
      .select('*')
      .eq('contract_id', contractId)
      .order('display_order', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async deleteForJob(jobId: string): Promise<void> {
    const { error } = await this.db.from('document_lines').delete().eq('job_id', jobId);
    if (error) throw error;
  }
}

// -----------------------------------------------------------------------------
// PricingRepository — wraps the compute_line_pricing RPC
//
// This is the ONLY way the application reads prices. All callers — line
// pickers, services, importers — must go through this method. There is
// deliberately no public method that reads service_pricing/contract_pricing
// row data raw; whenever a price is needed, ask compute_line_pricing.
// -----------------------------------------------------------------------------
export interface ComputedPrice {
  unit_price: number;
  cost_price: number;
  is_covered: boolean;
  pricing_source: string;
  description_ar: string;
  description_en: string | null;
  unit: string;
}

export interface ComputePricingArgs {
  line_type: LineType;
  service_id?: string | null;
  part_id?: string | null;
  gas_id?: string | null;
  customer_machine_id?: string | null;
  machine_master_id?: string | null;
  request_type: string | null; // CASH/CO/CW/CWC/UG (or COG/CWG/CWCG for contract_unit)
  quantity?: number;
}

export class PricingRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async compute(args: ComputePricingArgs): Promise<ComputedPrice> {
    const { data, error } = await this.db.rpc('compute_line_pricing' as any, {
      p_line_type: args.line_type,
      p_service_id: args.service_id ?? null,
      p_part_id: args.part_id ?? null,
      p_gas_id: args.gas_id ?? null,
      p_customer_machine_id: args.customer_machine_id ?? null,
      p_machine_master_id: args.machine_master_id ?? null,
      p_request_type: args.request_type,
      p_quantity: args.quantity ?? 1,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('compute_line_pricing returned no rows');
    return {
      unit_price: Number(row.unit_price ?? 0),
      cost_price: Number(row.cost_price ?? 0),
      is_covered: !!row.is_covered,
      pricing_source: row.pricing_source ?? '',
      description_ar: row.description_ar ?? '',
      description_en: row.description_en,
      unit: row.unit ?? 'unit',
    };
  }
}
