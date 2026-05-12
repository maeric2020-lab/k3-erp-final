import type { K3SupabaseClient, Database } from '@k3/shared-types';

export interface SalesReportRow {
  day: string;
  invoice_count: number;
  invoiced_total: number;
  paid_total: number;
  outstanding_total: number;
}

export interface PaymentAgingRow {
  customer_id: string;
  customer_name: string;
  current_total: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
  total_outstanding: number;
}

export interface TechnicianPerfRow {
  technician_id: string;
  technician_name: string;
  technician_code: string | null;
  jobs_completed: number;
  jobs_cancelled: number;
  avg_minutes_arrival_to_complete: number | null;
  total_invoiced: number;
}

export interface JobsByTechRow {
  technician_id: string;
  technician_name: string;
  status: string;
  count: number;
}

export interface PartsConsumptionRow {
  part_id: string;
  part_code: string;
  part_name_ar: string;
  part_name_en: string;
  total_quantity: number;
  total_value: number;
  job_count: number;
}

export interface GasConsumptionRow {
  gas_id: string;
  gas_name: string;
  total_quantity: number;
  total_value: number;
  job_count: number;
}

export interface CustomerBalanceRow {
  customer_id: string;
  customer_code: string;
  customer_name_ar: string;
  customer_name_en: string | null;
  total_invoiced: number;
  total_paid: number;
  total_outstanding: number;
  invoice_count: number;
}

export interface ActiveContractRow {
  contract_id: string;
  contract_no: string;
  contract_type: string;
  is_4_year: boolean;
  customer_name: string;
  start_date: string;
  end_date: string;
  days_remaining: number;
  total_amount: number;
  machine_count: number;
}

const num = (x: any): number => Number(x ?? 0);

/**
 * ReportsRepository — wraps the 8 report RPCs. Each respects RLS, so users
 * see only what they're authorised to see across the underlying tables.
 */
export class ReportsRepository {
  constructor(private readonly db: K3SupabaseClient) {}

  async sales(fromDate: string, toDate: string): Promise<SalesReportRow[]> {
    const { data, error } = await this.db.rpc('fn_report_sales' as any, {
      p_from_date: fromDate, p_to_date: toDate,
    });
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      day: String(r.day),
      invoice_count: num(r.invoice_count),
      invoiced_total: num(r.invoiced_total),
      paid_total: num(r.paid_total),
      outstanding_total: num(r.outstanding_total),
    }));
  }

  async paymentAging(): Promise<PaymentAgingRow[]> {
    const { data, error } = await this.db.rpc('fn_report_payment_aging' as any);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      customer_id: String(r.customer_id),
      customer_name: String(r.customer_name ?? '—'),
      current_total: num(r.current_total),
      d1_30: num(r.d1_30),
      d31_60: num(r.d31_60),
      d61_90: num(r.d61_90),
      d90_plus: num(r.d90_plus),
      total_outstanding: num(r.total_outstanding),
    }));
  }

  async technicianPerf(fromDate: string, toDate: string): Promise<TechnicianPerfRow[]> {
    const { data, error } = await this.db.rpc('fn_report_technician_perf' as any, {
      p_from_date: fromDate, p_to_date: toDate,
    });
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      technician_id: String(r.technician_id),
      technician_name: String(r.technician_name ?? '—'),
      technician_code: r.technician_code ?? null,
      jobs_completed: num(r.jobs_completed),
      jobs_cancelled: num(r.jobs_cancelled),
      avg_minutes_arrival_to_complete: r.avg_minutes_arrival_to_complete == null ? null : num(r.avg_minutes_arrival_to_complete),
      total_invoiced: num(r.total_invoiced),
    }));
  }

  async jobsByTech(): Promise<JobsByTechRow[]> {
    const { data, error } = await this.db.rpc('fn_report_jobs_by_tech' as any);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      technician_id: String(r.technician_id),
      technician_name: String(r.technician_name ?? '—'),
      status: String(r.status),
      count: num(r.count),
    }));
  }

  async partsConsumption(fromDate: string, toDate: string): Promise<PartsConsumptionRow[]> {
    const { data, error } = await this.db.rpc('fn_report_parts_consumption' as any, {
      p_from_date: fromDate, p_to_date: toDate,
    });
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      part_id: String(r.part_id),
      part_code: String(r.part_code ?? ''),
      part_name_ar: String(r.part_name_ar ?? ''),
      part_name_en: String(r.part_name_en ?? ''),
      total_quantity: num(r.total_quantity),
      total_value: num(r.total_value),
      job_count: num(r.job_count),
    }));
  }

  async gasConsumption(fromDate: string, toDate: string): Promise<GasConsumptionRow[]> {
    const { data, error } = await this.db.rpc('fn_report_gas_consumption' as any, {
      p_from_date: fromDate, p_to_date: toDate,
    });
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      gas_id: String(r.gas_id),
      gas_name: String(r.gas_name ?? ''),
      total_quantity: num(r.total_quantity),
      total_value: num(r.total_value),
      job_count: num(r.job_count),
    }));
  }

  async customerBalances(): Promise<CustomerBalanceRow[]> {
    const { data, error } = await this.db.rpc('fn_report_customer_balances' as any);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      customer_id: String(r.customer_id),
      customer_code: String(r.customer_code ?? ''),
      customer_name_ar: String(r.customer_name_ar ?? ''),
      customer_name_en: r.customer_name_en ?? null,
      total_invoiced: num(r.total_invoiced),
      total_paid: num(r.total_paid),
      total_outstanding: num(r.total_outstanding),
      invoice_count: num(r.invoice_count),
    }));
  }

  async activeContracts(): Promise<ActiveContractRow[]> {
    const { data, error } = await this.db.rpc('fn_report_active_contracts' as any);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      contract_id: String(r.contract_id),
      contract_no: String(r.contract_no),
      contract_type: String(r.contract_type),
      is_4_year: Boolean(r.is_4_year),
      customer_name: String(r.customer_name ?? '—'),
      start_date: String(r.start_date),
      end_date: String(r.end_date),
      days_remaining: num(r.days_remaining),
      total_amount: num(r.total_amount),
      machine_count: num(r.machine_count),
    }));
  }
}
