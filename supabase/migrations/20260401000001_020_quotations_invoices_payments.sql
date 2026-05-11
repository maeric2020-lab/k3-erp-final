-- =============================================================================
-- K3 ERP — Migration 020
-- Quotations, invoices, payments. Auto-invoice on job completion.
--
-- Decision #3: every completed job auto-generates an invoice. Zero-charge
-- invoices are created for fully-covered work (UG, or all lines is_covered).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Quotations  (standalone — not tied to a job)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quotations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_no    text NOT NULL UNIQUE,                 -- auto: QUO-NNNNN
  customer_id     uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  site_id         uuid REFERENCES public.customer_sites(id) ON DELETE SET NULL,
  -- The pricing context the quotation uses for line lookups
  request_type    text NOT NULL DEFAULT 'CASH' CHECK (request_type IN ('CASH','CO','CW','CWC','UG')),
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','rejected','expired','cancelled')),
  issue_date      date NOT NULL DEFAULT current_date,
  valid_until     date,
  subtotal        numeric(14,3) NOT NULL DEFAULT 0,
  discount        numeric(14,3) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total_amount    numeric(14,3) NOT NULL DEFAULT 0,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES public.users_profile(id),
  updated_by      uuid REFERENCES public.users_profile(id)
);

CREATE INDEX IF NOT EXISTS idx_quotations_customer ON public.quotations (customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status   ON public.quotations (status);

DROP TRIGGER IF EXISTS trg_quotations_updated_at ON public.quotations;
CREATE TRIGGER trg_quotations_updated_at
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE OR REPLACE FUNCTION public.fn_quotations_assign_no()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.quotation_no IS NULL OR NEW.quotation_no = '' THEN
    NEW.quotation_no := public.fn_next_doc_no('QUO');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotations_assign_no ON public.quotations;
CREATE TRIGGER trg_quotations_assign_no
  BEFORE INSERT ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.fn_quotations_assign_no();

-- -----------------------------------------------------------------------------
-- Invoices
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no      text NOT NULL UNIQUE,                 -- auto: INV-NNNNN
  customer_id     uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  site_id         uuid REFERENCES public.customer_sites(id) ON DELETE SET NULL,
  job_id          uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  contract_id     uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  request_type    text CHECK (request_type IN ('CASH','CO','CW','CWC','UG')),
  status          text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','partial','paid','cancelled','void')),
  issue_date      date NOT NULL DEFAULT current_date,
  due_date        date,
  subtotal        numeric(14,3) NOT NULL DEFAULT 0,
  discount        numeric(14,3) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total_amount    numeric(14,3) NOT NULL DEFAULT 0,
  amount_paid     numeric(14,3) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  balance         numeric(14,3) GENERATED ALWAYS AS (round(total_amount - amount_paid, 3)) STORED,
  is_zero_charge  boolean NOT NULL DEFAULT false,       -- true when fully covered
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES public.users_profile(id),
  updated_by      uuid REFERENCES public.users_profile(id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices (customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job      ON public.invoices (job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contract ON public.invoices (contract_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status   ON public.invoices (status);

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE OR REPLACE FUNCTION public.fn_invoices_assign_no()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.invoice_no IS NULL OR NEW.invoice_no = '' THEN
    NEW.invoice_no := public.fn_next_doc_no('INV');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_assign_no ON public.invoices;
CREATE TRIGGER trg_invoices_assign_no
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.fn_invoices_assign_no();

-- -----------------------------------------------------------------------------
-- Now that invoices exists, add the FK from jobs.invoice_id (was a placeholder)
-- and from quotations FK targets to document_lines
-- -----------------------------------------------------------------------------
ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS fk_jobs_invoice;
ALTER TABLE public.jobs
  ADD CONSTRAINT fk_jobs_invoice
    FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;

-- Wire up document_lines polymorphic targets to the new tables
ALTER TABLE public.document_lines
  DROP CONSTRAINT IF EXISTS document_lines_quotation_id_fkey;
ALTER TABLE public.document_lines
  ADD CONSTRAINT document_lines_quotation_id_fkey
    FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;

ALTER TABLE public.document_lines
  DROP CONSTRAINT IF EXISTS document_lines_invoice_id_fkey;
ALTER TABLE public.document_lines
  ADD CONSTRAINT document_lines_invoice_id_fkey
    FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;

-- -----------------------------------------------------------------------------
-- Recalc triggers — keep subtotals/totals in sync when document_lines change
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_quotations_recalc()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_qid uuid;
  v_subtotal numeric;
  v_discount numeric;
BEGIN
  v_qid := COALESCE(NEW.quotation_id, OLD.quotation_id);
  IF v_qid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
    FROM public.document_lines WHERE quotation_id = v_qid;
  SELECT discount INTO v_discount FROM public.quotations WHERE id = v_qid;
  UPDATE public.quotations
    SET subtotal = v_subtotal,
        total_amount = GREATEST(round(v_subtotal - COALESCE(v_discount, 0), 3), 0)
    WHERE id = v_qid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_dl_recalc_quotation_total ON public.document_lines;
CREATE TRIGGER trg_dl_recalc_quotation_total
  AFTER INSERT OR UPDATE OR DELETE ON public.document_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_quotations_recalc();

CREATE OR REPLACE FUNCTION public.fn_invoices_recalc()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_iid uuid;
  v_subtotal numeric;
  v_discount numeric;
BEGIN
  v_iid := COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF v_iid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
    FROM public.document_lines WHERE invoice_id = v_iid;
  SELECT discount INTO v_discount FROM public.invoices WHERE id = v_iid;
  UPDATE public.invoices
    SET subtotal = v_subtotal,
        total_amount = GREATEST(round(v_subtotal - COALESCE(v_discount, 0), 3), 0)
    WHERE id = v_iid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_dl_recalc_invoice_total ON public.document_lines;
CREATE TRIGGER trg_dl_recalc_invoice_total
  AFTER INSERT OR UPDATE OR DELETE ON public.document_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_invoices_recalc();

CREATE OR REPLACE FUNCTION public.fn_contracts_recalc()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_cid uuid;
  v_total numeric;
BEGIN
  v_cid := COALESCE(NEW.contract_id, OLD.contract_id);
  IF v_cid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT COALESCE(SUM(line_total), 0) INTO v_total
    FROM public.document_lines WHERE contract_id = v_cid;
  -- Also include attached machines snapshots
  v_total := v_total + COALESCE((SELECT SUM(unit_price_at_signing) FROM public.contract_machines WHERE contract_id = v_cid), 0);
  UPDATE public.contracts SET total_amount = v_total WHERE id = v_cid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_dl_recalc_contract_total ON public.document_lines;
CREATE TRIGGER trg_dl_recalc_contract_total
  AFTER INSERT OR UPDATE OR DELETE ON public.document_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_contracts_recalc();

DROP TRIGGER IF EXISTS trg_cm_recalc_contract_total ON public.contract_machines;
CREATE TRIGGER trg_cm_recalc_contract_total
  AFTER INSERT OR UPDATE OR DELETE ON public.contract_machines
  FOR EACH ROW EXECUTE FUNCTION public.fn_contracts_recalc();

-- -----------------------------------------------------------------------------
-- Payments — applied against invoices
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_no      text NOT NULL UNIQUE,                 -- auto: PAY-NNNNN
  invoice_id      uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  customer_id     uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  amount          numeric(14,3) NOT NULL CHECK (amount > 0),
  method          text NOT NULL CHECK (method IN ('cash','knet','transfer','cheque','card','other')),
  reference       text,
  payment_date    date NOT NULL DEFAULT current_date,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES public.users_profile(id),
  updated_by      uuid REFERENCES public.users_profile(id)
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice  ON public.payments (invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON public.payments (customer_id);

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE OR REPLACE FUNCTION public.fn_payments_assign_no()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.payment_no IS NULL OR NEW.payment_no = '' THEN
    NEW.payment_no := public.fn_next_doc_no('PAY');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_assign_no ON public.payments;
CREATE TRIGGER trg_payments_assign_no
  BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_payments_assign_no();

-- Recalculate invoice.amount_paid and invoice.status whenever a payment changes
CREATE OR REPLACE FUNCTION public.fn_payments_recalc_invoice()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_invoice_id uuid;
  v_paid numeric;
  v_total numeric;
  v_status text;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF v_invoice_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT COALESCE(SUM(amount), 0) INTO v_paid FROM public.payments WHERE invoice_id = v_invoice_id;
  SELECT total_amount, status INTO v_total, v_status FROM public.invoices WHERE id = v_invoice_id;
  -- Don't override cancelled/void invoices
  IF v_status IN ('cancelled', 'void') THEN
    UPDATE public.invoices SET amount_paid = v_paid WHERE id = v_invoice_id;
  ELSIF v_paid <= 0 THEN
    UPDATE public.invoices SET amount_paid = 0, status = 'issued' WHERE id = v_invoice_id;
  ELSIF v_paid >= v_total THEN
    UPDATE public.invoices SET amount_paid = v_paid, status = 'paid' WHERE id = v_invoice_id;
  ELSE
    UPDATE public.invoices SET amount_paid = v_paid, status = 'partial' WHERE id = v_invoice_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_recalc_invoice ON public.payments;
CREATE TRIGGER trg_payments_recalc_invoice
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_payments_recalc_invoice();

-- -----------------------------------------------------------------------------
-- Auto-mark zero-charge invoices as paid on creation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_invoices_zero_charge_paid()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_zero_charge AND NEW.total_amount = 0 THEN
    NEW.status := 'paid';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_zero_charge ON public.invoices;
CREATE TRIGGER trg_invoices_zero_charge
  BEFORE INSERT OR UPDATE OF total_amount, is_zero_charge ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.fn_invoices_zero_charge_paid();

-- -----------------------------------------------------------------------------
-- Numbering sequences
-- -----------------------------------------------------------------------------
INSERT INTO public.numbering_sequences (id, prefix, year_resets, current_year, current_value, pad_width, separator, description)
VALUES
  ('QUO', 'QUO', false, EXTRACT(YEAR FROM now())::int, 0, 5, '-', 'Quotation numbers'),
  ('INV', 'INV', false, EXTRACT(YEAR FROM now())::int, 0, 5, '-', 'Invoice numbers'),
  ('PAY', 'PAY', false, EXTRACT(YEAR FROM now())::int, 0, 5, '-', 'Payment numbers')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quo_select ON public.quotations;
CREATE POLICY quo_select ON public.quotations FOR SELECT TO authenticated
  USING (public.fn_has_screen_permission('quotations', 'view'));
DROP POLICY IF EXISTS quo_insert ON public.quotations;
CREATE POLICY quo_insert ON public.quotations FOR INSERT TO authenticated
  WITH CHECK (public.fn_has_screen_permission('quotations', 'add'));
DROP POLICY IF EXISTS quo_update ON public.quotations;
CREATE POLICY quo_update ON public.quotations FOR UPDATE TO authenticated
  USING (public.fn_has_screen_permission('quotations', 'edit'))
  WITH CHECK (public.fn_has_screen_permission('quotations', 'edit'));
DROP POLICY IF EXISTS quo_delete ON public.quotations;
CREATE POLICY quo_delete ON public.quotations FOR DELETE TO authenticated
  USING (public.fn_has_screen_permission('quotations', 'delete'));

DROP POLICY IF EXISTS inv_select ON public.invoices;
CREATE POLICY inv_select ON public.invoices FOR SELECT TO authenticated
  USING (public.fn_has_screen_permission('invoices', 'view'));
DROP POLICY IF EXISTS inv_insert ON public.invoices;
CREATE POLICY inv_insert ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (public.fn_has_screen_permission('invoices', 'add') OR public.fn_is_super_admin());
DROP POLICY IF EXISTS inv_update ON public.invoices;
CREATE POLICY inv_update ON public.invoices FOR UPDATE TO authenticated
  USING (public.fn_has_screen_permission('invoices', 'edit'))
  WITH CHECK (public.fn_has_screen_permission('invoices', 'edit'));
DROP POLICY IF EXISTS inv_delete ON public.invoices;
CREATE POLICY inv_delete ON public.invoices FOR DELETE TO authenticated
  USING (public.fn_has_screen_permission('invoices', 'delete'));

DROP POLICY IF EXISTS pay_select ON public.payments;
CREATE POLICY pay_select ON public.payments FOR SELECT TO authenticated
  USING (public.fn_has_screen_permission('payments', 'view'));
DROP POLICY IF EXISTS pay_insert ON public.payments;
CREATE POLICY pay_insert ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.fn_has_screen_permission('payments', 'add'));
DROP POLICY IF EXISTS pay_update ON public.payments;
CREATE POLICY pay_update ON public.payments FOR UPDATE TO authenticated
  USING (public.fn_has_screen_permission('payments', 'edit'))
  WITH CHECK (public.fn_has_screen_permission('payments', 'edit'));
DROP POLICY IF EXISTS pay_delete ON public.payments;
CREATE POLICY pay_delete ON public.payments FOR DELETE TO authenticated
  USING (public.fn_has_screen_permission('payments', 'delete'));

-- -----------------------------------------------------------------------------
-- Update document_lines RLS for invoices and quotations
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS dl_select ON public.document_lines;
CREATE POLICY dl_select ON public.document_lines FOR SELECT TO authenticated
  USING (
    (job_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = document_lines.job_id
        AND (j.technician_id = auth.uid() OR public.fn_has_screen_permission('jobs', 'view'))))
    OR (contract_id IS NOT NULL AND public.fn_has_screen_permission('contracts', 'view'))
    OR (quotation_id IS NOT NULL AND public.fn_has_screen_permission('quotations', 'view'))
    OR (invoice_id IS NOT NULL AND public.fn_has_screen_permission('invoices', 'view'))
    OR public.fn_is_super_admin()
  );

DROP POLICY IF EXISTS dl_insert ON public.document_lines;
CREATE POLICY dl_insert ON public.document_lines FOR INSERT TO authenticated
  WITH CHECK (
    (job_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = document_lines.job_id
        AND (j.technician_id = auth.uid() OR public.fn_has_screen_permission('jobs', 'edit'))))
    OR (contract_id IS NOT NULL AND public.fn_has_screen_permission('contracts', 'edit'))
    OR (quotation_id IS NOT NULL AND public.fn_has_screen_permission('quotations', 'edit'))
    OR (invoice_id IS NOT NULL AND public.fn_has_screen_permission('invoices', 'edit'))
    OR public.fn_is_super_admin()
  );

DROP POLICY IF EXISTS dl_update ON public.document_lines;
CREATE POLICY dl_update ON public.document_lines FOR UPDATE TO authenticated
  USING (
    (job_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = document_lines.job_id
        AND (j.technician_id = auth.uid() OR public.fn_has_screen_permission('jobs', 'edit'))))
    OR (contract_id IS NOT NULL AND public.fn_has_screen_permission('contracts', 'edit'))
    OR (quotation_id IS NOT NULL AND public.fn_has_screen_permission('quotations', 'edit'))
    OR (invoice_id IS NOT NULL AND public.fn_has_screen_permission('invoices', 'edit'))
    OR public.fn_is_super_admin()
  )
  WITH CHECK (
    (job_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = document_lines.job_id
        AND (j.technician_id = auth.uid() OR public.fn_has_screen_permission('jobs', 'edit'))))
    OR (contract_id IS NOT NULL AND public.fn_has_screen_permission('contracts', 'edit'))
    OR (quotation_id IS NOT NULL AND public.fn_has_screen_permission('quotations', 'edit'))
    OR (invoice_id IS NOT NULL AND public.fn_has_screen_permission('invoices', 'edit'))
    OR public.fn_is_super_admin()
  );

DROP POLICY IF EXISTS dl_delete ON public.document_lines;
CREATE POLICY dl_delete ON public.document_lines FOR DELETE TO authenticated
  USING (
    (job_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = document_lines.job_id
        AND (j.technician_id = auth.uid() OR public.fn_has_screen_permission('jobs', 'edit'))))
    OR (quotation_id IS NOT NULL AND public.fn_has_screen_permission('quotations', 'edit'))
    OR (invoice_id IS NOT NULL AND public.fn_has_screen_permission('invoices', 'edit'))
    OR public.fn_is_super_admin()
  );

-- -----------------------------------------------------------------------------
-- generate_invoice_for_job() — called by the JobsService when a job hits 'completed'
-- This function clones the job's document_lines into a new invoice, sets
-- is_zero_charge if every line is_covered, and links job.invoice_id back.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_generate_invoice_for_job(p_job_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job             public.jobs%ROWTYPE;
  v_invoice_id      uuid;
  v_subtotal        numeric;
  v_all_covered     boolean;
  v_actor           uuid;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found: %', p_job_id; END IF;
  IF v_job.invoice_id IS NOT NULL THEN
    -- Already has an invoice
    RETURN v_job.invoice_id;
  END IF;

  -- Calculate the subtotal and whether everything is covered
  SELECT COALESCE(SUM(line_total), 0), bool_and(is_covered)
    INTO v_subtotal, v_all_covered
    FROM public.document_lines
   WHERE job_id = p_job_id;

  v_all_covered := COALESCE(v_all_covered, true); -- empty job → treat as covered
  v_actor := auth.uid();

  INSERT INTO public.invoices (
    customer_id, site_id, job_id, contract_id, request_type,
    issue_date, subtotal, total_amount, is_zero_charge,
    status, created_by, updated_by
  ) VALUES (
    v_job.customer_id, v_job.site_id, v_job.id, v_job.contract_id, v_job.request_type,
    current_date,
    v_subtotal,
    CASE WHEN v_all_covered THEN 0 ELSE v_subtotal END,
    v_all_covered,
    CASE WHEN v_all_covered THEN 'paid' ELSE 'issued' END,
    v_actor, v_actor
  )
  RETURNING id INTO v_invoice_id;

  -- Re-point the job's lines to also belong to the invoice (job_id stays;
  -- invoice_id is added so the invoice presents the same lines).
  UPDATE public.document_lines
     SET invoice_id = v_invoice_id,
         updated_at = now()
   WHERE job_id = p_job_id;

  -- Link back
  UPDATE public.jobs
     SET invoice_id = v_invoice_id
   WHERE id = p_job_id;

  RETURN v_invoice_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_generate_invoice_for_job(uuid) TO authenticated;
