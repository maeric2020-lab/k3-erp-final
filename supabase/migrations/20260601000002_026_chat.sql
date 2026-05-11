-- =============================================================================
-- K3 ERP — Migration 026
-- Phase 6c — Internal chat (threads, members, messages, attachments)
--
-- Schema:
--   chat_threads       — 1-to-1 or group; group threads have a name
--   chat_thread_members — user × thread; tracks last_read_at for unread badges
--   chat_messages      — text or voice messages with optional attachments JSONB
--
-- Storage bucket 'chat-attachments' is created separately via Supabase admin
-- (see PHASE6_COMPLETION.md). The attachments JSONB is an array of:
--   [{ name, mime, size, storage_path }, ...]
-- with up to 10 entries per message and 25MB per entry. A voice message has
-- exactly one attachment with mime starting 'audio/'.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- chat_threads
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_threads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text,
  is_group        boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES public.users_profile(id),
  last_message_at timestamptz,
  CONSTRAINT chk_chat_threads_group_name CHECK (
    (is_group = false) OR (is_group = true AND name IS NOT NULL AND length(trim(name)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_last_message_at ON public.chat_threads (last_message_at DESC NULLS LAST);

DROP TRIGGER IF EXISTS trg_chat_threads_updated_at ON public.chat_threads;
CREATE TRIGGER trg_chat_threads_updated_at BEFORE UPDATE ON public.chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- -----------------------------------------------------------------------------
-- chat_thread_members
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_thread_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  joined_at     timestamptz NOT NULL DEFAULT now(),
  last_read_at  timestamptz,
  is_muted      boolean NOT NULL DEFAULT false,
  UNIQUE (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_thread_members_user ON public.chat_thread_members (user_id);

-- -----------------------------------------------------------------------------
-- chat_messages
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id    uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  sender_id    uuid NOT NULL REFERENCES public.users_profile(id) ON DELETE RESTRICT,
  body         text,
  attachments  jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_deleted   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  edited_at    timestamptz,
  CONSTRAINT chk_chat_messages_content CHECK (
    -- Either body or at least one attachment
    (body IS NOT NULL AND length(trim(body)) > 0)
    OR jsonb_array_length(attachments) > 0
  ),
  CONSTRAINT chk_chat_messages_attachments_size CHECK (
    jsonb_array_length(attachments) <= 10
  )
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON public.chat_messages (thread_id, created_at DESC);

-- Bump thread.last_message_at on insert
CREATE OR REPLACE FUNCTION public.fn_chat_messages_bump_thread()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.chat_threads
     SET last_message_at = NEW.created_at,
         updated_at = NEW.created_at
   WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_messages_bump_thread ON public.chat_messages;
CREATE TRIGGER trg_chat_messages_bump_thread AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.fn_chat_messages_bump_thread();

-- -----------------------------------------------------------------------------
-- RLS — only thread members can see threads, members, and messages
-- -----------------------------------------------------------------------------
ALTER TABLE public.chat_threads        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_thread_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages       ENABLE ROW LEVEL SECURITY;

-- chat_threads: members can SELECT; anyone authenticated can INSERT (creating
-- a thread). Updates limited to creators or the system.
DROP POLICY IF EXISTS chat_threads_select_members ON public.chat_threads;
CREATE POLICY chat_threads_select_members ON public.chat_threads FOR SELECT TO authenticated
  USING (
    public.fn_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.chat_thread_members m
       WHERE m.thread_id = chat_threads.id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS chat_threads_insert_authenticated ON public.chat_threads;
CREATE POLICY chat_threads_insert_authenticated ON public.chat_threads FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS chat_threads_update_creator ON public.chat_threads;
CREATE POLICY chat_threads_update_creator ON public.chat_threads FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.fn_is_super_admin())
  WITH CHECK (created_by = auth.uid() OR public.fn_is_super_admin());

-- chat_thread_members: visible if you are a member of the same thread.
-- Inserts allowed by thread creator or by self (joining a thread you have a link to).
DROP POLICY IF EXISTS chat_thread_members_select_member ON public.chat_thread_members;
CREATE POLICY chat_thread_members_select_member ON public.chat_thread_members FOR SELECT TO authenticated
  USING (
    public.fn_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.chat_thread_members m
       WHERE m.thread_id = chat_thread_members.thread_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS chat_thread_members_insert_creator_or_self ON public.chat_thread_members;
CREATE POLICY chat_thread_members_insert_creator_or_self ON public.chat_thread_members FOR INSERT TO authenticated
  WITH CHECK (
    public.fn_is_super_admin()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.chat_threads t
       WHERE t.id = chat_thread_members.thread_id AND t.created_by = auth.uid()
    )
  );

-- Members can update their own row (for last_read_at, is_muted).
DROP POLICY IF EXISTS chat_thread_members_update_self ON public.chat_thread_members;
CREATE POLICY chat_thread_members_update_self ON public.chat_thread_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- chat_messages: members can SELECT; senders can INSERT in their threads.
DROP POLICY IF EXISTS chat_messages_select_member ON public.chat_messages;
CREATE POLICY chat_messages_select_member ON public.chat_messages FOR SELECT TO authenticated
  USING (
    public.fn_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.chat_thread_members m
       WHERE m.thread_id = chat_messages.thread_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS chat_messages_insert_member ON public.chat_messages;
CREATE POLICY chat_messages_insert_member ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_thread_members m
       WHERE m.thread_id = chat_messages.thread_id AND m.user_id = auth.uid()
    )
  );

-- Senders can soft-delete their own messages (set is_deleted=true).
DROP POLICY IF EXISTS chat_messages_update_sender ON public.chat_messages;
CREATE POLICY chat_messages_update_sender ON public.chat_messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR public.fn_is_super_admin())
  WITH CHECK (sender_id = auth.uid() OR public.fn_is_super_admin());

-- -----------------------------------------------------------------------------
-- fn_chat_create_or_get_dm(p_other_user_id) — convenience for 1-to-1 chats.
-- Looks for an existing non-group thread that has exactly the two users; if
-- not found, creates one.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_chat_create_or_get_dm(p_other_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_thread_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_other_user_id = v_actor THEN
    RAISE EXCEPTION 'Cannot DM yourself';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users_profile WHERE id = p_other_user_id AND is_active = true AND is_archived = false) THEN
    RAISE EXCEPTION 'Target user not found or inactive';
  END IF;

  -- Try to find an existing 1-to-1 thread between the two users
  SELECT t.id INTO v_thread_id
    FROM public.chat_threads t
    JOIN public.chat_thread_members m1 ON m1.thread_id = t.id AND m1.user_id = v_actor
    JOIN public.chat_thread_members m2 ON m2.thread_id = t.id AND m2.user_id = p_other_user_id
   WHERE t.is_group = false
     AND (SELECT count(*) FROM public.chat_thread_members WHERE thread_id = t.id) = 2
   LIMIT 1;

  IF v_thread_id IS NOT NULL THEN
    RETURN v_thread_id;
  END IF;

  INSERT INTO public.chat_threads (is_group, created_by) VALUES (false, v_actor) RETURNING id INTO v_thread_id;
  INSERT INTO public.chat_thread_members (thread_id, user_id) VALUES
    (v_thread_id, v_actor),
    (v_thread_id, p_other_user_id);

  RETURN v_thread_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_chat_create_or_get_dm(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_chat_create_or_get_dm(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- fn_chat_thread_summary() — list threads visible to the caller, with last
-- message preview, unread count, and other-party identity for 1-to-1 threads.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_chat_thread_summary()
RETURNS TABLE (
  thread_id        uuid,
  is_group         boolean,
  name             text,
  last_message_at  timestamptz,
  last_message_preview text,
  last_sender_id   uuid,
  unread_count     integer,
  other_user_id    uuid,
  other_user_name  text,
  member_count     integer
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  WITH my_threads AS (
    SELECT t.*, m.last_read_at
      FROM public.chat_threads t
      JOIN public.chat_thread_members m ON m.thread_id = t.id
     WHERE m.user_id = auth.uid()
  ),
  last_msgs AS (
    SELECT DISTINCT ON (thread_id)
      thread_id, sender_id, body, attachments, created_at
      FROM public.chat_messages
     WHERE is_deleted = false
       AND thread_id IN (SELECT id FROM my_threads)
     ORDER BY thread_id, created_at DESC
  ),
  unread AS (
    SELECT m.thread_id, count(*)::integer AS cnt
      FROM public.chat_messages m
      JOIN my_threads t ON t.id = m.thread_id
     WHERE m.sender_id != auth.uid()
       AND m.is_deleted = false
       AND (t.last_read_at IS NULL OR m.created_at > t.last_read_at)
     GROUP BY m.thread_id
  ),
  other AS (
    -- For 1-to-1 threads, the "other" user
    SELECT DISTINCT ON (m.thread_id)
      m.thread_id, m.user_id AS other_user_id,
      COALESCE(u.full_name_ar, u.full_name_en, u.email) AS other_user_name
      FROM public.chat_thread_members m
      JOIN public.users_profile u ON u.id = m.user_id
     WHERE m.user_id != auth.uid()
       AND m.thread_id IN (SELECT id FROM my_threads WHERE is_group = false)
  ),
  member_counts AS (
    SELECT thread_id, count(*)::integer AS cnt
      FROM public.chat_thread_members
     WHERE thread_id IN (SELECT id FROM my_threads)
     GROUP BY thread_id
  )
  SELECT
    t.id,
    t.is_group,
    t.name,
    t.last_message_at,
    CASE
      WHEN lm.body IS NOT NULL AND length(trim(lm.body)) > 0 THEN
        CASE WHEN length(lm.body) > 120 THEN substring(lm.body, 1, 120) || '…' ELSE lm.body END
      WHEN jsonb_array_length(COALESCE(lm.attachments, '[]'::jsonb)) > 0 THEN '📎 attachment'
      ELSE NULL
    END AS last_message_preview,
    lm.sender_id AS last_sender_id,
    COALESCE(u.cnt, 0) AS unread_count,
    o.other_user_id,
    o.other_user_name,
    COALESCE(mc.cnt, 0) AS member_count
  FROM my_threads t
  LEFT JOIN last_msgs lm ON lm.thread_id = t.id
  LEFT JOIN unread u ON u.thread_id = t.id
  LEFT JOIN other o ON o.thread_id = t.id
  LEFT JOIN member_counts mc ON mc.thread_id = t.id
  ORDER BY t.last_message_at DESC NULLS LAST, t.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.fn_chat_thread_summary() TO authenticated;

-- -----------------------------------------------------------------------------
-- Phase 6c screen seeds
-- -----------------------------------------------------------------------------
INSERT INTO public.screens (code, module, label_ar, label_en, default_actions, display_order) VALUES
  ('chat', 'communication', 'المحادثات', 'Chat', ARRAY['view','add','delete'], 10)
ON CONFLICT (code) DO NOTHING;
