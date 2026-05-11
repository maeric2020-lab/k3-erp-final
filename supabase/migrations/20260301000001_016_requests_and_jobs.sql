-- =============================================================================
-- K3 ERP — Migration 016
-- Maintenance requests, jobs, technician workflow.
--
-- maintenance_request: a customer's report of a problem (created by office
--   staff after a phone call, or by a technician on site).
-- job: the unit of work — assigned to a technician, walks through a strict
--   status machine. Technicians never pick a status manually; statuses
--   transition automatically as the technician completes each step.
--
-- A maintenance_request can spawn multiple jobs (e.g., one for inspection,
-- one for the actual repair after parts arrive).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- maintenance_requests
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.maintenance_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_no          text NOT NULL UNIQUE,                  -- auto: REQ-NNNNN
  customer_id         uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  site_id             uuid REFERENCES public.customer_sites(id) ON DELETE SET NULL,
  customer_machine_id uuid REFERENCES public.customer_machines(id) ON DELETE SET NULL,
  contract_id         uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  request_type        text NOT NULL CHECK (request_type IN (
    'CASH','CO','CW','CWC','UG'
  )),
  -- Predefined problem code OR free-text "other" (only allowed if
  -- company_settings.allow_other_problem = true)
  problem_code        text NOT NULL CHECK (problem_code IN (
    'no_cooling','weak_cooling','water_leak','gas_leak','compressor_issue',
    'fan_motor_issue','electrical_issue','sensor_issue','thermostat_issue',
    'noise','bad_smell','drainage_issue','other'
  )),
  problem_description text,                                  -- required when problem_code='other'
  reported_by         text,                                  -- name of the person who called
  reported_phone      text,
  scheduled_date      date,
  scheduled_time      time,
  priority            text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status              text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','closed','cancelled')),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES public.users_profile(id),
  updated_by          uuid REFERENCES public.users_profile(id),
  CHECK (problem_code <> 'other' OR problem_description IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_mr_customer  ON public.maintenance_requests (customer_id);
CREATE INDEX IF NOT EXISTS idx_mr_site      ON public.maintenance_requests (site_id);
CREATE INDEX IF NOT EXISTS idx_mr_status    ON public.maintenance_requests (status);
CREATE INDEX IF NOT EXISTS idx_mr_scheduled ON public.maintenance_requests (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_mr_contract  ON public.maintenance_requests (contract_id);

DROP TRIGGER IF EXISTS trg_mr_updated_at ON public.maintenance_requests;
CREATE TRIGGER trg_mr_updated_at
  BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE OR REPLACE FUNCTION public.fn_mr_assign_no()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.request_no IS NULL OR NEW.request_no = '' THEN
    NEW.request_no := public.fn_next_doc_no('REQ');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mr_assign_no ON public.maintenance_requests;
CREATE TRIGGER trg_mr_assign_no
  BEFORE INSERT ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_mr_assign_no();

-- Block 'other' problem when company_settings forbids it
CREATE OR REPLACE FUNCTION public.fn_mr_check_other_allowed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_allow boolean;
BEGIN
  IF NEW.problem_code = 'other' THEN
    SELECT allow_other_problem INTO v_allow FROM public.company_settings ORDER BY id LIMIT 1;
    IF NOT COALESCE(v_allow, false) THEN
      RAISE EXCEPTION 'Other-problem is disabled by company settings';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mr_check_other ON public.maintenance_requests;
CREATE TRIGGER trg_mr_check_other
  BEFORE INSERT OR UPDATE OF problem_code ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_mr_check_other_allowed();

-- -----------------------------------------------------------------------------
-- jobs  — the technician's unit of work, with a strict status machine
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jobs (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_no                   text NOT NULL UNIQUE,             -- auto: JOB-NNNNN
  request_id               uuid NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE RESTRICT,
  customer_id              uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  site_id                  uuid REFERENCES public.customer_sites(id) ON DELETE SET NULL,
  customer_machine_id      uuid REFERENCES public.customer_machines(id) ON DELETE SET NULL,
  contract_id              uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  request_type             text NOT NULL CHECK (request_type IN ('CASH','CO','CW','CWC','UG')),
  technician_id            uuid REFERENCES public.users_profile(id) ON DELETE SET NULL,
  -- Strict status machine. Transitions are policed by a trigger below; the
  -- technician never picks a status manually.
  status                   text NOT NULL DEFAULT 'assigned' CHECK (status IN (
    'assigned',           -- created and assigned to a technician
    'accepted',           -- tech tapped "Accept"
    'on_way',             -- tech tapped "I'm on my way"
    'arrived',            -- tech tapped "Arrived"
    'inspection_started', -- tech tapped "Start inspection"
    'work_started',       -- tech tapped "Start work" (after picking line items)
    'report_pending',     -- tech tapped "Mark complete" — awaiting signatures
    'completed',          -- both signatures captured
    'invoiced',           -- invoice generated automatically (zero-charge if covered)
    'closed',             -- payment recorded or contract-only with nothing to collect
    'cancelled'
  )),
  -- Status transition timestamps for traceability
  assigned_at              timestamptz,
  accepted_at              timestamptz,
  on_way_at                timestamptz,
  arrived_at               timestamptz,
  inspection_started_at    timestamptz,
  work_started_at          timestamptz,
  report_pending_at        timestamptz,
  completed_at             timestamptz,
  invoiced_at              timestamptz,
  closed_at                timestamptz,
  cancelled_at             timestamptz,
  -- Geolocation snapshots when status changes (audit trail)
  arrived_lat              numeric(10,7),
  arrived_lng              numeric(10,7),
  -- Signatures (storage paths within 'signatures' bucket)
  technician_signature_path text,
  customer_signature_path   text,
  customer_signature_name   text,
  -- Output
  technician_notes         text,
  inspection_notes         text,
  total_amount             numeric(14,3) NOT NULL DEFAULT 0,
  invoice_id               uuid,                              -- FK added in 018 once invoices exist
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  created_by               uuid REFERENCES public.users_profile(id),
  updated_by               uuid REFERENCES public.users_profile(id),
  CHECK (
    -- Technician signature is REQUIRED before status can advance past report_pending
    status NOT IN ('completed','invoiced','closed') OR technician_signature_path IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_jobs_request    ON public.jobs (request_id);
CREATE INDEX IF NOT EXISTS idx_jobs_customer   ON public.jobs (customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_technician ON public.jobs (technician_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status     ON public.jobs (status);
CREATE INDEX IF NOT EXISTS idx_jobs_contract   ON public.jobs (contract_id);

DROP TRIGGER IF EXISTS trg_jobs_updated_at ON public.jobs;
CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE OR REPLACE FUNCTION public.fn_jobs_assign_no()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.job_no IS NULL OR NEW.job_no = '' THEN
    NEW.job_no := public.fn_next_doc_no('JOB');
  END IF;
  IF NEW.assigned_at IS NULL THEN NEW.assigned_at := now(); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_assign_no ON public.jobs;
CREATE TRIGGER trg_jobs_assign_no
  BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.fn_jobs_assign_no();

-- Status machine: enforce valid transitions and stamp the *_at column
CREATE OR REPLACE FUNCTION public.fn_jobs_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_valid boolean := false;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Allowed transitions (both directions for cancel from anywhere, otherwise forward-only)
  IF NEW.status = 'cancelled' AND OLD.status NOT IN ('completed','invoiced','closed') THEN
    v_valid := true;
    NEW.cancelled_at := now();
  ELSIF (OLD.status, NEW.status) IN (
    ('assigned',           'accepted'),
    ('accepted',           'on_way'),
    ('on_way',             'arrived'),
    ('arrived',            'inspection_started'),
    ('inspection_started', 'work_started'),
    ('work_started',       'report_pending'),
    ('report_pending',     'completed'),
    ('completed',          'invoiced'),
    ('invoiced',           'closed'),
    -- Edge: report_pending may revert to work_started if signatures are rejected
    ('report_pending',     'work_started')
  ) THEN
    v_valid := true;
  END IF;

  IF NOT v_valid THEN
    RAISE EXCEPTION 'Illegal job status transition: % -> %', OLD.status, NEW.status;
  END IF;

  -- Stamp the appropriate *_at column
  CASE NEW.status
    WHEN 'accepted'           THEN NEW.accepted_at           := now();
    WHEN 'on_way'             THEN NEW.on_way_at             := now();
    WHEN 'arrived'            THEN NEW.arrived_at            := now();
    WHEN 'inspection_started' THEN NEW.inspection_started_at := now();
    WHEN 'work_started'       THEN NEW.work_started_at       := now();
    WHEN 'report_pending'     THEN NEW.report_pending_at     := now();
    WHEN 'completed'          THEN NEW.completed_at          := now();
    WHEN 'invoiced'           THEN NEW.invoiced_at           := now();
    WHEN 'closed'             THEN NEW.closed_at             := now();
    ELSE NULL;
  END CASE;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_status_transition ON public.jobs;
CREATE TRIGGER trg_jobs_status_transition
  BEFORE UPDATE OF status ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.fn_jobs_status_transition();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs                 ENABLE ROW LEVEL SECURITY;

-- maintenance_requests
DROP POLICY IF EXISTS mr_select ON public.maintenance_requests;
CREATE POLICY mr_select ON public.maintenance_requests FOR SELECT TO authenticated
  USING (public.fn_has_screen_permission('maintenance_requests', 'view'));

DROP POLICY IF EXISTS mr_insert ON public.maintenance_requests;
CREATE POLICY mr_insert ON public.maintenance_requests FOR INSERT TO authenticated
  WITH CHECK (public.fn_has_screen_permission('maintenance_requests', 'add'));

DROP POLICY IF EXISTS mr_update ON public.maintenance_requests;
CREATE POLICY mr_update ON public.maintenance_requests FOR UPDATE TO authenticated
  USING (public.fn_has_screen_permission('maintenance_requests', 'edit'))
  WITH CHECK (public.fn_has_screen_permission('maintenance_requests', 'edit'));

DROP POLICY IF EXISTS mr_delete ON public.maintenance_requests;
CREATE POLICY mr_delete ON public.maintenance_requests FOR DELETE TO authenticated
  USING (public.fn_has_screen_permission('maintenance_requests', 'delete'));

-- jobs: a technician can SELECT their own assigned jobs even without "jobs:view"
DROP POLICY IF EXISTS jobs_select ON public.jobs;
CREATE POLICY jobs_select ON public.jobs FOR SELECT TO authenticated
  USING (
    technician_id = auth.uid()
    OR public.fn_has_screen_permission('jobs', 'view')
  );

DROP POLICY IF EXISTS jobs_insert ON public.jobs;
CREATE POLICY jobs_insert ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (public.fn_has_screen_permission('jobs', 'add'));

-- jobs: a technician can UPDATE their own job (to advance status etc.); office
-- staff with jobs:edit can update any job.
DROP POLICY IF EXISTS jobs_update ON public.jobs;
CREATE POLICY jobs_update ON public.jobs FOR UPDATE TO authenticated
  USING (
    technician_id = auth.uid()
    OR public.fn_has_screen_permission('jobs', 'edit')
  )
  WITH CHECK (
    technician_id = auth.uid()
    OR public.fn_has_screen_permission('jobs', 'edit')
  );

DROP POLICY IF EXISTS jobs_delete ON public.jobs;
CREATE POLICY jobs_delete ON public.jobs FOR DELETE TO authenticated
  USING (public.fn_has_screen_permission('jobs', 'delete'));
