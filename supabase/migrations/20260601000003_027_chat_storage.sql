-- =============================================================================
-- K3 ERP — Migration 027
-- Phase 6c — Chat attachments storage bucket
--
-- Creates the 'chat-attachments' bucket and RLS:
--   * Authenticated users can upload to a path they own (their thread + their userId).
--   * Authenticated users can read attachments for threads they're members of.
-- The storage path convention is enforced by the upload endpoint:
--   {threadId}/{userId}/{timestamp}_{filename}
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-attachments', 'chat-attachments', false, 26214400 /* 25 MB */, NULL)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage.objects (the catch-all storage table)
-- Note: the storage schema RLS is enabled by default; we just add policies.

-- Read: only members of the thread referenced in path[1] (the threadId)
DROP POLICY IF EXISTS chat_attachments_read ON storage.objects;
CREATE POLICY chat_attachments_read ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (
      public.fn_is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.chat_thread_members m
         WHERE m.thread_id = (storage.foldername(name))[1]::uuid
           AND m.user_id = auth.uid()
      )
    )
  );

-- Insert: must be a member of the thread, and the second path segment must be auth.uid()
DROP POLICY IF EXISTS chat_attachments_insert ON storage.objects;
CREATE POLICY chat_attachments_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.chat_thread_members m
       WHERE m.thread_id = (storage.foldername(name))[1]::uuid
         AND m.user_id = auth.uid()
    )
  );

-- Delete: only the uploader or super_admin
DROP POLICY IF EXISTS chat_attachments_delete ON storage.objects;
CREATE POLICY chat_attachments_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (
      public.fn_is_super_admin()
      OR (storage.foldername(name))[2] = auth.uid()::text
    )
  );
