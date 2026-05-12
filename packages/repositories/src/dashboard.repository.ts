import type { K3SupabaseClient, Database } from '@k3/shared-types';

export interface DashboardTodayJobs {
  total: number;
  in_field: number;
  working: number;
  completed_today: number;
  pending_assignment: number;
}

export interface DashboardOpenRequests {
  total: number;
  emergency: number;
  high: number;
  normal: number;
  low: number;
}

export interface DashboardOverdueInvoices {
  count_overdue: number;
  count_due_soon: number;
  total_outstanding: number;
  total_overdue: number;
}

export interface DashboardRevenueMtd {
  mtd_total: number;
  prev_month_total: number;
  invoice_count: number;
  daily_series: Array<{ date: string; amount: number }>;
}

const num = (x: any): number => Number(x ?? 0);

/**
 * DashboardRepository — wraps the four widget RPCs. Each RPC is RLS-aware,
 * so a technician viewing their dashboard sees only their own data, while
 * office staff with the appropriate screen perms see organisation-wide totals.
 */
export class DashboardRepository {
  constructor(private readonly db: K3SupabaseClient) {}

  async todayJobs(): Promise<DashboardTodayJobs> {
    const { data, error } = await this.db.rpc('fn_dashboard_today_jobs' as any);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return {
      total: num(row?.total),
      in_field: num(row?.in_field),
      working: num(row?.working),
      completed_today: num(row?.completed_today),
      pending_assignment: num(row?.pending_assignment),
    };
  }

  async openRequests(): Promise<DashboardOpenRequests> {
    const { data, error } = await this.db.rpc('fn_dashboard_open_requests' as any);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return {
      total: num(row?.total),
      emergency: num(row?.emergency),
      high: num(row?.high),
      normal: num(row?.normal),
      low: num(row?.low),
    };
  }

  async overdueInvoices(): Promise<DashboardOverdueInvoices> {
    const { data, error } = await this.db.rpc('fn_dashboard_overdue_invoices' as any);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return {
      count_overdue: num(row?.count_overdue),
      count_due_soon: num(row?.count_due_soon),
      total_outstanding: num(row?.total_outstanding),
      total_overdue: num(row?.total_overdue),
    };
  }

  async revenueMtd(): Promise<DashboardRevenueMtd> {
    const { data, error } = await this.db.rpc('fn_dashboard_revenue_mtd' as any);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    const series = Array.isArray(row?.daily_series) ? row.daily_series : [];
    return {
      mtd_total: num(row?.mtd_total),
      prev_month_total: num(row?.prev_month_total),
      invoice_count: num(row?.invoice_count),
      daily_series: series.map((p: any) => ({ date: String(p.date), amount: num(p.amount) })),
    };
  }
}
