-- =============================================================================
-- K3 ERP — Migration 024
-- Phase 6a — Dashboard widgets
--
-- Aggregation RPCs feeding the four dashboard widgets:
--   1. fn_dashboard_today_jobs      — count + breakdown by status
--   2. fn_dashboard_open_requests   — count by priority
--   3. fn_dashboard_overdue_invoices — count + total balance
--   4. fn_dashboard_revenue_mtd     — totals for MTD and previous month
--
-- Each respects RLS: a technician sees their own jobs; office staff with
-- jobs:view see everyone's. The RPCs are STABLE (read-only) and lean on
-- the underlying RLS so we don't have to re-encode access rules.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- fn_dashboard_today_jobs()
-- Returns the count of jobs whose any timeline timestamp falls today, plus
-- counts by status group. RLS scopes the underlying SELECT.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_dashboard_today_jobs()
RETURNS TABLE (
  total              integer,
  in_field           integer,
  working            integer,
  completed_today    integer,
  pending_assignment integer
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  WITH today_jobs AS (
    SELECT id, status, technician_id,
           accepted_at, on_way_at, arrived_at, inspection_started_at,
           work_started_at, report_pending_at, completed_at,
           created_at, updated_at
      FROM public.jobs
     WHERE (
            DATE(created_at)         = current_date OR
            DATE(updated_at)         = current_date OR
            DATE(completed_at)       = current_date OR
            DATE(work_started_at)    = current_date OR
            DATE(arrived_at)         = current_date
           )
       AND status NOT IN ('closed', 'cancelled')
  )
  SELECT
    (SELECT count(*)::integer FROM today_jobs) AS total,
    (SELECT count(*)::integer FROM today_jobs
       WHERE status IN ('accepted','on_way','arrived','inspection_started')) AS in_field,
    (SELECT count(*)::integer FROM today_jobs
       WHERE status IN ('work_started','report_pending')) AS working,
    (SELECT count(*)::integer FROM public.jobs
       WHERE DATE(completed_at) = current_date) AS completed_today,
    (SELECT count(*)::integer FROM today_jobs
       WHERE technician_id IS NULL) AS pending_assignment;
$$;

GRANT EXECUTE ON FUNCTION public.fn_dashboard_today_jobs() TO authenticated;

-- -----------------------------------------------------------------------------
-- fn_dashboard_open_requests()
-- Returns count of open/in-progress requests, broken down by priority.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_dashboard_open_requests()
RETURNS TABLE (
  total      integer,
  emergency  integer,
  high       integer,
  normal     integer,
  low        integer
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  WITH open_reqs AS (
    SELECT priority FROM public.maintenance_requests
     WHERE status IN ('open','in_progress')
  )
  SELECT
    (SELECT count(*)::integer FROM open_reqs) AS total,
    (SELECT count(*)::integer FROM open_reqs WHERE priority = 'urgent') AS emergency,
    (SELECT count(*)::integer FROM open_reqs WHERE priority = 'high')   AS high,
    (SELECT count(*)::integer FROM open_reqs WHERE priority = 'normal') AS normal,
    (SELECT count(*)::integer FROM open_reqs WHERE priority = 'low')    AS low;
$$;

GRANT EXECUTE ON FUNCTION public.fn_dashboard_open_requests() TO authenticated;

-- -----------------------------------------------------------------------------
-- fn_dashboard_overdue_invoices()
-- Counts invoices past their due date with non-zero balance, plus the total
-- outstanding amount. Excludes cancelled/void.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_dashboard_overdue_invoices()
RETURNS TABLE (
  count_overdue  integer,
  count_due_soon integer,   -- due in next 7 days
  total_outstanding numeric,
  total_overdue numeric
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  WITH outstanding AS (
    SELECT id, due_date, balance
      FROM public.invoices
     WHERE status IN ('issued','partial')
       AND balance > 0
  )
  SELECT
    (SELECT count(*)::integer FROM outstanding
       WHERE due_date IS NOT NULL AND due_date < current_date) AS count_overdue,
    (SELECT count(*)::integer FROM outstanding
       WHERE due_date IS NOT NULL
         AND due_date >= current_date
         AND due_date <= current_date + interval '7 days') AS count_due_soon,
    (SELECT COALESCE(SUM(balance), 0) FROM outstanding) AS total_outstanding,
    (SELECT COALESCE(SUM(balance), 0) FROM outstanding
       WHERE due_date IS NOT NULL AND due_date < current_date) AS total_overdue;
$$;

GRANT EXECUTE ON FUNCTION public.fn_dashboard_overdue_invoices() TO authenticated;

-- -----------------------------------------------------------------------------
-- fn_dashboard_revenue_mtd()
-- Returns invoiced totals (sum of total_amount, excluding cancelled/void) for
-- the current month-to-date, the previous calendar month, and a daily series
-- for the current month for spark-line rendering.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_dashboard_revenue_mtd()
RETURNS TABLE (
  mtd_total       numeric,
  prev_month_total numeric,
  invoice_count   integer,
  daily_series    jsonb
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  WITH bounds AS (
    SELECT
      date_trunc('month', current_date)::date                AS month_start,
      (date_trunc('month', current_date) - interval '1 day')::date AS prev_month_end,
      (date_trunc('month', current_date) - interval '1 month')::date AS prev_month_start
  ),
  mtd_invoices AS (
    SELECT issue_date, total_amount FROM public.invoices, bounds
     WHERE status NOT IN ('cancelled','void')
       AND issue_date >= bounds.month_start
       AND issue_date <= current_date
  ),
  prev_invoices AS (
    SELECT total_amount FROM public.invoices, bounds
     WHERE status NOT IN ('cancelled','void')
       AND issue_date >= bounds.prev_month_start
       AND issue_date <= bounds.prev_month_end
  ),
  daily AS (
    SELECT issue_date::text AS d, SUM(total_amount) AS amt
      FROM mtd_invoices
     GROUP BY issue_date
     ORDER BY issue_date
  )
  SELECT
    COALESCE((SELECT SUM(total_amount) FROM mtd_invoices), 0) AS mtd_total,
    COALESCE((SELECT SUM(total_amount) FROM prev_invoices), 0) AS prev_month_total,
    (SELECT count(*)::integer FROM mtd_invoices) AS invoice_count,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('date', d, 'amount', amt) ORDER BY d) FROM daily),
      '[]'::jsonb
    ) AS daily_series;
$$;

GRANT EXECUTE ON FUNCTION public.fn_dashboard_revenue_mtd() TO authenticated;
