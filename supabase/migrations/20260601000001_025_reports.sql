-- =============================================================================
-- K3 ERP — Migration 025
-- Phase 6b — Reports infrastructure
--
-- Reports are server-side aggregations exposed as SECURITY INVOKER functions.
-- They lean on RLS for visibility — a user without invoices:view sees nothing
-- in the sales report. Each report takes (from_date, to_date) bounds and
-- returns a tabular result the UI can render and export to CSV.
--
-- Reports shipped in this migration:
--   1. fn_report_sales              — invoice totals by day with payment status
--   2. fn_report_payment_aging      — outstanding invoices bucketed 0-30/31-60/61-90/90+ days
--   3. fn_report_technician_perf    — completed jobs per technician with avg time
--   4. fn_report_jobs_by_tech       — job counts by status per technician
--   5. fn_report_parts_consumption  — total quantity of each spare part used
--   6. fn_report_gas_consumption    — total quantity of each gas refilled
--   7. fn_report_customer_balances  — outstanding balance per customer
--   8. fn_report_active_contracts   — active contracts with end-date proximity
--
-- Plus screen seeds for the reports module.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Sales report — invoiced amount per day, with paid/unpaid splits
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_report_sales(
  p_from_date date,
  p_to_date   date
)
RETURNS TABLE (
  day              date,
  invoice_count    integer,
  invoiced_total   numeric,
  paid_total       numeric,
  outstanding_total numeric
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT
    issue_date AS day,
    count(*)::integer AS invoice_count,
    COALESCE(SUM(total_amount), 0) AS invoiced_total,
    COALESCE(SUM(amount_paid), 0) AS paid_total,
    COALESCE(SUM(balance), 0) AS outstanding_total
  FROM public.invoices
  WHERE status NOT IN ('cancelled','void')
    AND issue_date >= p_from_date
    AND issue_date <= p_to_date
  GROUP BY issue_date
  ORDER BY issue_date;
$$;

GRANT EXECUTE ON FUNCTION public.fn_report_sales(date, date) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Payment aging — outstanding invoices bucketed by overdue duration
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_report_payment_aging()
RETURNS TABLE (
  customer_id    uuid,
  customer_name  text,
  current_total  numeric,   -- not yet due
  d1_30          numeric,
  d31_60         numeric,
  d61_90         numeric,
  d90_plus       numeric,
  total_outstanding numeric
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  WITH outstanding AS (
    SELECT
      i.customer_id,
      c.name_ar AS customer_name,
      i.balance,
      CASE
        WHEN i.due_date IS NULL OR i.due_date >= current_date THEN 'current'
        WHEN current_date - i.due_date BETWEEN 1 AND 30 THEN 'd1_30'
        WHEN current_date - i.due_date BETWEEN 31 AND 60 THEN 'd31_60'
        WHEN current_date - i.due_date BETWEEN 61 AND 90 THEN 'd61_90'
        ELSE 'd90_plus'
      END AS bucket
    FROM public.invoices i
    JOIN public.customers c ON c.id = i.customer_id
    WHERE i.status IN ('issued','partial')
      AND i.balance > 0
  )
  SELECT
    o.customer_id,
    o.customer_name,
    COALESCE(SUM(CASE WHEN o.bucket = 'current'  THEN o.balance ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN o.bucket = 'd1_30'    THEN o.balance ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN o.bucket = 'd31_60'   THEN o.balance ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN o.bucket = 'd61_90'   THEN o.balance ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN o.bucket = 'd90_plus' THEN o.balance ELSE 0 END), 0),
    COALESCE(SUM(o.balance), 0)
  FROM outstanding o
  GROUP BY o.customer_id, o.customer_name
  ORDER BY 8 DESC;
$$;

GRANT EXECUTE ON FUNCTION public.fn_report_payment_aging() TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Technician performance — completed jobs and average completion time
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_report_technician_perf(
  p_from_date date,
  p_to_date   date
)
RETURNS TABLE (
  technician_id      uuid,
  technician_name    text,
  technician_code    text,
  jobs_completed     integer,
  jobs_cancelled     integer,
  avg_minutes_arrival_to_complete numeric,
  total_invoiced     numeric
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT
    j.technician_id,
    COALESCE(u.full_name_ar, u.full_name_en, u.email) AS technician_name,
    u.technician_code AS technician_code,
    SUM(CASE WHEN j.status IN ('completed','invoiced','closed') THEN 1 ELSE 0 END)::integer AS jobs_completed,
    SUM(CASE WHEN j.status = 'cancelled' THEN 1 ELSE 0 END)::integer AS jobs_cancelled,
    AVG(
      CASE
        WHEN j.completed_at IS NOT NULL AND j.arrived_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (j.completed_at - j.arrived_at)) / 60.0
        ELSE NULL
      END
    )::numeric AS avg_minutes_arrival_to_complete,
    -- Total invoiced through the related invoice (jobs.invoice_id), excluding void/cancelled
    COALESCE(SUM(
      CASE WHEN inv.status NOT IN ('cancelled','void') THEN inv.total_amount ELSE 0 END
    ), 0) AS total_invoiced
  FROM public.jobs j
  JOIN public.users_profile u ON u.id = j.technician_id
  LEFT JOIN public.invoices inv ON inv.id = j.invoice_id
  WHERE j.technician_id IS NOT NULL
    AND DATE(j.created_at) >= p_from_date
    AND DATE(j.created_at) <= p_to_date
  GROUP BY j.technician_id, u.full_name_ar, u.full_name_en, u.email, u.technician_code
  ORDER BY jobs_completed DESC;
$$;

GRANT EXECUTE ON FUNCTION public.fn_report_technician_perf(date, date) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Jobs by technician status breakdown (snapshot, no date filter)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_report_jobs_by_tech()
RETURNS TABLE (
  technician_id   uuid,
  technician_name text,
  status          text,
  count           integer
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT
    j.technician_id,
    COALESCE(u.full_name_ar, u.full_name_en, u.email) AS technician_name,
    j.status,
    count(*)::integer AS count
  FROM public.jobs j
  JOIN public.users_profile u ON u.id = j.technician_id
  WHERE j.technician_id IS NOT NULL
    AND j.status NOT IN ('closed','cancelled')
  GROUP BY j.technician_id, u.full_name_ar, u.full_name_en, u.email, j.status
  ORDER BY technician_name, j.status;
$$;

GRANT EXECUTE ON FUNCTION public.fn_report_jobs_by_tech() TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Parts consumption — total quantity of each spare part used
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_report_parts_consumption(
  p_from_date date,
  p_to_date   date
)
RETURNS TABLE (
  part_id        uuid,
  part_code      text,
  part_name_ar   text,
  part_name_en   text,
  total_quantity numeric,
  total_value    numeric,
  job_count      integer
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT
    dl.part_id,
    sp.part_code AS part_code,
    sp.name_ar AS part_name_ar,
    sp.name_en AS part_name_en,
    COALESCE(SUM(dl.quantity), 0) AS total_quantity,
    COALESCE(SUM(dl.line_total), 0) AS total_value,
    count(DISTINCT dl.job_id)::integer AS job_count
  FROM public.document_lines dl
  JOIN public.spare_parts_master sp ON sp.id = dl.part_id
  WHERE dl.line_type = 'part'
    AND dl.part_id IS NOT NULL
    AND DATE(dl.created_at) >= p_from_date
    AND DATE(dl.created_at) <= p_to_date
  GROUP BY dl.part_id, sp.part_code, sp.name_ar, sp.name_en
  ORDER BY total_quantity DESC;
$$;

GRANT EXECUTE ON FUNCTION public.fn_report_parts_consumption(date, date) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. Gas consumption — total quantity of each gas refilled
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_report_gas_consumption(
  p_from_date date,
  p_to_date   date
)
RETURNS TABLE (
  gas_id         uuid,
  gas_name       text,
  total_quantity numeric,
  total_value    numeric,
  job_count      integer
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT
    dl.gas_id,
    rt.name AS gas_name,
    COALESCE(SUM(dl.quantity), 0) AS total_quantity,
    COALESCE(SUM(dl.line_total), 0) AS total_value,
    count(DISTINCT dl.job_id)::integer AS job_count
  FROM public.document_lines dl
  JOIN public.gas_types_master g    ON g.id = dl.gas_id
  JOIN public.refrigerant_types rt  ON rt.id = g.refrigerant_id
  WHERE dl.line_type = 'gas'
    AND dl.gas_id IS NOT NULL
    AND DATE(dl.created_at) >= p_from_date
    AND DATE(dl.created_at) <= p_to_date
  GROUP BY dl.gas_id, rt.name
  ORDER BY total_quantity DESC;
$$;

GRANT EXECUTE ON FUNCTION public.fn_report_gas_consumption(date, date) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. Customer balances — outstanding amount per customer
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_report_customer_balances()
RETURNS TABLE (
  customer_id      uuid,
  customer_code    text,
  customer_name_ar text,
  customer_name_en text,
  total_invoiced   numeric,
  total_paid       numeric,
  total_outstanding numeric,
  invoice_count    integer
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT
    i.customer_id,
    c.code AS customer_code,
    c.name_ar AS customer_name_ar,
    c.name_en AS customer_name_en,
    COALESCE(SUM(i.total_amount), 0) AS total_invoiced,
    COALESCE(SUM(i.amount_paid), 0) AS total_paid,
    COALESCE(SUM(i.balance), 0) AS total_outstanding,
    count(*)::integer AS invoice_count
  FROM public.invoices i
  JOIN public.customers c ON c.id = i.customer_id
  WHERE i.status NOT IN ('cancelled','void')
  GROUP BY i.customer_id, c.code, c.name_ar, c.name_en
  HAVING COALESCE(SUM(i.balance), 0) > 0
  ORDER BY total_outstanding DESC;
$$;

GRANT EXECUTE ON FUNCTION public.fn_report_customer_balances() TO authenticated;

-- -----------------------------------------------------------------------------
-- 8. Active contracts — contracts with end-date proximity
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_report_active_contracts()
RETURNS TABLE (
  contract_id     uuid,
  contract_no     text,
  contract_type   text,
  is_4_year       boolean,
  customer_name   text,
  start_date      date,
  end_date        date,
  days_remaining  integer,
  total_amount    numeric,
  machine_count   integer
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT
    c.id,
    c.contract_no,
    c.contract_type,
    c.is_4_year,
    cu.name_ar AS customer_name,
    c.start_date,
    c.end_date,
    (c.end_date - current_date)::integer AS days_remaining,
    c.total_amount,
    (SELECT count(*)::integer FROM public.contract_machines cm WHERE cm.contract_id = c.id) AS machine_count
  FROM public.contracts c
  JOIN public.customers cu ON cu.id = c.customer_id
  WHERE c.status = 'active'
    AND c.end_date >= current_date
  ORDER BY days_remaining ASC;
$$;

GRANT EXECUTE ON FUNCTION public.fn_report_active_contracts() TO authenticated;

-- -----------------------------------------------------------------------------
-- Reports screen seeds
-- -----------------------------------------------------------------------------
INSERT INTO public.screens (code, module, label_ar, label_en, default_actions, display_order) VALUES
  ('report_sales',                'reports', 'تقرير المبيعات',          'Sales report',           ARRAY['view','export'], 10),
  ('report_payment_aging',        'reports', 'تقرير أعمار الديون',       'Payment aging',          ARRAY['view','export'], 20),
  ('report_technician_perf',      'reports', 'أداء الفنيين',             'Technician performance', ARRAY['view','export'], 30),
  ('report_jobs_by_tech',         'reports', 'الوظائف حسب الفني',         'Jobs by technician',     ARRAY['view','export'], 31),
  ('report_parts_consumption',    'reports', 'استهلاك قطع الغيار',        'Parts consumption',      ARRAY['view','export'], 40),
  ('report_gas_consumption',      'reports', 'استهلاك الغازات',           'Gas consumption',        ARRAY['view','export'], 41),
  ('report_customer_balances',    'reports', 'أرصدة العملاء',             'Customer balances',      ARRAY['view','export'], 50),
  ('report_active_contracts',     'reports', 'العقود النشطة',             'Active contracts',       ARRAY['view','export'], 60)
ON CONFLICT (code) DO NOTHING;
