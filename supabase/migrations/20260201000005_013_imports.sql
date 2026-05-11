-- =============================================================================
-- K3 ERP — Migration 013
-- Excel import infrastructure: import_runs + import_run_rows
--
-- The import flow has two stages:
--   1. UPLOAD & PREVIEW: parse the Excel file, validate every row, write each
--      row to import_run_rows with action ('insert'|'update'|'skip'|'error').
--      Nothing is committed to the target tables yet.
--   2. COMMIT: in a single DB transaction, apply each valid row to its target
--      table and stamp import_runs.status = 'committed'.
--
-- This split lets the user review issues, fix the file or proceed selectively,
-- and lets us atomically roll back the whole batch if anything fails.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.import_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type   text NOT NULL CHECK (template_type IN (
    'machines', 'services', 'parts', 'gas',
    'service_pricing', 'contract_pricing',
    'customers', 'machine_categories', 'service_categories', 'service_types',
    'spare_part_categories', 'machine_brands'
  )),
  uploaded_by     uuid REFERENCES public.users_profile(id),
  source_filename text,
  source_path     text,                                  -- Storage path within 'imports' bucket
  total_rows      integer NOT NULL DEFAULT 0,
  inserted_rows   integer NOT NULL DEFAULT 0,
  updated_rows    integer NOT NULL DEFAULT 0,
  skipped_rows    integer NOT NULL DEFAULT 0,
  failed_rows     integer NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'previewing' CHECK (status IN (
    'previewing', 'committed', 'failed', 'cancelled'
  )),
  error_message   text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_import_runs_uploaded_by ON public.import_runs (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_import_runs_started_at  ON public.import_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_runs_template    ON public.import_runs (template_type);

-- -----------------------------------------------------------------------------
-- import_run_rows  (one row per Excel row, for preview & error report)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_run_rows (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            uuid NOT NULL REFERENCES public.import_runs(id) ON DELETE CASCADE,
  row_number        integer NOT NULL,                       -- 1-indexed source row
  raw_data          jsonb NOT NULL,                         -- the original row content (snapshot)
  resolved_data     jsonb,                                  -- normalised, with FKs resolved
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,     -- array of {field, message}
  action            text NOT NULL DEFAULT 'pending' CHECK (action IN (
    'pending', 'insert', 'update', 'skip', 'error'
  )),
  target_id         uuid,                                   -- inserted/updated record id (after commit)
  target_table      text,                                   -- bookkeeping for traceability
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, row_number)
);

CREATE INDEX IF NOT EXISTS idx_import_rows_run    ON public.import_run_rows (run_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_action ON public.import_run_rows (run_id, action);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.import_runs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_run_rows   ENABLE ROW LEVEL SECURITY;

-- Users can see their own runs; super_admins and import_runs:view holders see all
DROP POLICY IF EXISTS ir_select ON public.import_runs;
CREATE POLICY ir_select ON public.import_runs FOR SELECT TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.fn_is_super_admin()
    OR public.fn_has_screen_permission('import_runs', 'view')
  );

DROP POLICY IF EXISTS ir_insert ON public.import_runs;
CREATE POLICY ir_insert ON public.import_runs FOR INSERT TO authenticated
  WITH CHECK (
    -- Any user with an import permission on at least one master can create a run
    public.fn_has_screen_permission('machines_master', 'import')
    OR public.fn_has_screen_permission('services_master', 'import')
    OR public.fn_has_screen_permission('spare_parts_master', 'import')
    OR public.fn_has_screen_permission('service_pricing', 'import')
    OR public.fn_has_screen_permission('contract_pricing', 'import')
    OR public.fn_has_screen_permission('customers', 'import')
    OR public.fn_is_super_admin()
  );

DROP POLICY IF EXISTS ir_update ON public.import_runs;
CREATE POLICY ir_update ON public.import_runs FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR public.fn_is_super_admin())
  WITH CHECK (uploaded_by = auth.uid() OR public.fn_is_super_admin());

DROP POLICY IF EXISTS ir_delete ON public.import_runs;
CREATE POLICY ir_delete ON public.import_runs FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.fn_is_super_admin());

DROP POLICY IF EXISTS irr_all ON public.import_run_rows;
CREATE POLICY irr_all ON public.import_run_rows FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.import_runs r WHERE r.id = import_run_rows.run_id
            AND (r.uploaded_by = auth.uid() OR public.fn_is_super_admin()
                 OR public.fn_has_screen_permission('import_runs', 'view')))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.import_runs r WHERE r.id = import_run_rows.run_id
            AND (r.uploaded_by = auth.uid() OR public.fn_is_super_admin()))
  );
