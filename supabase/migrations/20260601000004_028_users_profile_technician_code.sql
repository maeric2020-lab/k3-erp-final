-- =============================================================================
-- K3 ERP — Migration 028
-- Phase 6 cleanup — add technician_code text column to users_profile
--
-- The original users_profile schema (migration 002) declared `technician_id`
-- as a uuid intended as an FK to a future `technicians` table. For the actual
-- ERP use case we need a short text code per technician (e.g. "TECH-01") for
-- reports and display. We add `technician_code` as the canonical text field
-- and leave `technician_id` reserved for future use.
-- =============================================================================

ALTER TABLE public.users_profile
  ADD COLUMN IF NOT EXISTS technician_code text;

CREATE INDEX IF NOT EXISTS idx_users_profile_technician_code ON public.users_profile (technician_code);

COMMENT ON COLUMN public.users_profile.technician_code IS
  'Short display code for technicians (e.g. TECH-01). Used in reports and field UI.';
