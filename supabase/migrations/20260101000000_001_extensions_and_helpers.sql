-- =============================================================================
-- K3 ERP — Migration 001
-- Extensions, base helpers, audit infrastructure
-- =============================================================================

-- pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- citext for case-insensitive emails
CREATE EXTENSION IF NOT EXISTS citext;

-- -----------------------------------------------------------------------------
-- updated_at trigger helper
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Audit log (super_admin viewable; written by triggers)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    uuid,
  before_data  jsonb,
  after_data   jsonb,
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity      ON public.audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user        ON public.audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at  ON public.audit_log (created_at DESC);

COMMENT ON TABLE public.audit_log IS 'Append-only audit trail. Inserts via triggers only. Visible only to super_admin.';
