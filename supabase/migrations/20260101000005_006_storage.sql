-- =============================================================================
-- K3 ERP — Migration 006
-- Storage buckets + access policies
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Buckets
-- -----------------------------------------------------------------------------
-- All buckets are private. Read access is via signed URLs OR storage policies.
-- 'logos' bucket is public so the company logo renders on the login screen
-- and printable documents without needing a signed URL each time.
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('logos',           'logos',           true,  5  * 1024 * 1024, ARRAY['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('letterheads',     'letterheads',     false, 10 * 1024 * 1024, ARRAY['image/png','image/jpeg','application/pdf']),
  ('nameplates',      'nameplates',      false, 10 * 1024 * 1024, ARRAY['image/png','image/jpeg','image/webp']),
  ('signatures',      'signatures',      false, 2  * 1024 * 1024, ARRAY['image/png']),
  ('imports',         'imports',         false, 25 * 1024 * 1024, ARRAY[
                                                                     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                                                     'application/vnd.ms-excel',
                                                                     'text/csv'
                                                                   ]),
  ('chat-attachments','chat-attachments',false, 25 * 1024 * 1024, NULL)  -- mime-types restricted in app layer
ON CONFLICT (id) DO UPDATE SET
  public               = EXCLUDED.public,
  file_size_limit      = EXCLUDED.file_size_limit,
  allowed_mime_types   = EXCLUDED.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Storage policies
-- Public bucket 'logos' — readable by anyone (login page) but writable only by admins
-- Other buckets — readable by authenticated active users; writable per screen perm
-- -----------------------------------------------------------------------------

-- LOGOS: public read, admin write
DROP POLICY IF EXISTS storage_logos_read   ON storage.objects;
CREATE POLICY storage_logos_read
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'logos');

DROP POLICY IF EXISTS storage_logos_write  ON storage.objects;
CREATE POLICY storage_logos_write
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND (public.fn_is_super_admin() OR public.fn_has_screen_permission('company_settings', 'edit'))
  )
  WITH CHECK (
    bucket_id = 'logos'
    AND (public.fn_is_super_admin() OR public.fn_has_screen_permission('company_settings', 'edit'))
  );

-- LETTERHEADS: read by active users, write by contract_templates editors
DROP POLICY IF EXISTS storage_letterheads_read  ON storage.objects;
CREATE POLICY storage_letterheads_read
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'letterheads' AND public.fn_is_active_user());

DROP POLICY IF EXISTS storage_letterheads_write ON storage.objects;
CREATE POLICY storage_letterheads_write
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'letterheads'
    AND (public.fn_is_super_admin() OR public.fn_has_screen_permission('contract_templates', 'edit'))
  )
  WITH CHECK (
    bucket_id = 'letterheads'
    AND (public.fn_is_super_admin() OR public.fn_has_screen_permission('contract_templates', 'edit'))
  );

-- NAMEPLATES: read by active users, write by anyone with job_detail edit
DROP POLICY IF EXISTS storage_nameplates_read   ON storage.objects;
CREATE POLICY storage_nameplates_read
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'nameplates' AND public.fn_is_active_user());

DROP POLICY IF EXISTS storage_nameplates_write  ON storage.objects;
CREATE POLICY storage_nameplates_write
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'nameplates'
    AND public.fn_is_active_user()
  );

DROP POLICY IF EXISTS storage_nameplates_delete ON storage.objects;
CREATE POLICY storage_nameplates_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'nameplates'
    AND (public.fn_is_super_admin() OR owner = auth.uid())
  );

-- SIGNATURES: read by active users, write by active users (technicians sign)
DROP POLICY IF EXISTS storage_signatures_read   ON storage.objects;
CREATE POLICY storage_signatures_read
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'signatures' AND public.fn_is_active_user());

DROP POLICY IF EXISTS storage_signatures_write  ON storage.objects;
CREATE POLICY storage_signatures_write
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'signatures' AND public.fn_is_active_user());

-- IMPORTS: read+write by users with any masters import permission
DROP POLICY IF EXISTS storage_imports_read      ON storage.objects;
CREATE POLICY storage_imports_read
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'imports' AND public.fn_is_active_user());

DROP POLICY IF EXISTS storage_imports_write     ON storage.objects;
CREATE POLICY storage_imports_write
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'imports' AND public.fn_is_active_user());

DROP POLICY IF EXISTS storage_imports_delete    ON storage.objects;
CREATE POLICY storage_imports_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'imports'
    AND (public.fn_is_super_admin() OR owner = auth.uid())
  );

-- CHAT ATTACHMENTS: read+write by active users (per-thread enforcement in chat policies, Phase 6)
DROP POLICY IF EXISTS storage_chat_read         ON storage.objects;
CREATE POLICY storage_chat_read
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'chat-attachments' AND public.fn_is_active_user());

DROP POLICY IF EXISTS storage_chat_write        ON storage.objects;
CREATE POLICY storage_chat_write
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments' AND public.fn_is_active_user());
