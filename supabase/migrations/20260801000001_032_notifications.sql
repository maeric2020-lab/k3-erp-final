-- =============================================================================
-- K3 ERP — ترحيل 032
-- المرحلة 8ج — نظام الإشعارات
--
-- يبني:
--   1. جدول notifications
--   2. جدول notification_preferences (المستخدم يختار ما يصله)
--   3. دوال helper لإرسال إشعارات
--   4. RLS بحسب company_id + user_id
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) أنواع الإشعارات
-- -----------------------------------------------------------------------------

-- نوع الإشعار: enum للتنسيق
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE public.notification_type AS ENUM (
      'job_assigned',           -- وظيفة جديدة أُسنِدت
      'job_status_changed',     -- تغيّرت حالة وظيفة
      'request_created',        -- طلب صيانة جديد
      'invoice_overdue',        -- فاتورة متأخرة
      'payment_received',       -- استُلمت دفعة
      'contract_expiring',      -- عقد قارب على الانتهاء
      'mention',                -- ذُكِر المستخدم في محادثة
      'system'                  -- إشعار نظام عام
    );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2) جدول notifications
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            public.notification_type NOT NULL,
  title_ar        text NOT NULL,
  title_en        text NOT NULL,
  body_ar         text,
  body_en         text,
  -- ربط اختياري بكيان (مثلاً معرّف الوظيفة)
  entity_type     text,                    -- 'job' | 'invoice' | 'request' | 'contract' | 'message'
  entity_id       uuid,
  -- رابط للنقر داخل التطبيق
  action_url      text,
  -- حالة القراءة
  read_at         timestamptz,
  -- ميتاداتا إضافية (مثلاً: من أرسل، تفاصيل الحدث)
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_user_unread ON public.notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notif_user_all ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_company ON public.notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notif_entity ON public.notifications(entity_type, entity_id) WHERE entity_id IS NOT NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- المستخدم يرى إشعاراته فقط
DROP POLICY IF EXISTS notifications_owner ON public.notifications;
CREATE POLICY notifications_owner ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- المستخدم يستطيع تعليم إشعاراته بأنها مقروءة
DROP POLICY IF EXISTS notifications_mark_read ON public.notifications;
CREATE POLICY notifications_mark_read ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- لا insert من العميل — فقط عبر دوال SECURITY DEFINER
-- (الإشعارات تُنشأ من triggers أو من الكود خادم)

-- super-admin يستطيع رؤية إشعارات شركته
DROP POLICY IF EXISTS notifications_admin ON public.notifications;
CREATE POLICY notifications_admin ON public.notifications FOR SELECT TO authenticated
  USING (
    company_id = public.fn_current_company_id()
    AND public.fn_is_super_admin()
  );

-- -----------------------------------------------------------------------------
-- 3) تفضيلات الإشعارات (لكل مستخدم)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- in-app (دائماً مُفعَّل، لا يُغلق)
  -- email (يحتاج تكامل مع SMTP — مؤجَّل لـ 8د)
  email_enabled        boolean NOT NULL DEFAULT true,
  -- web push
  push_enabled         boolean NOT NULL DEFAULT false,
  push_subscription    jsonb,           -- VAPID subscription من المتصفح
  -- أنواع الإشعارات المُفعَّلة (افتراضياً كلها)
  enabled_types        public.notification_type[] NOT NULL DEFAULT ARRAY[
    'job_assigned', 'job_status_changed', 'request_created',
    'invoice_overdue', 'payment_received', 'contract_expiring',
    'mention', 'system'
  ]::public.notification_type[],
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_notif_prefs_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_prefs_self ON public.notification_preferences;
CREATE POLICY notif_prefs_self ON public.notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 4) دالة helper لإرسال إشعار
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_notify(
  p_user_id     uuid,
  p_type        public.notification_type,
  p_title_ar    text,
  p_title_en    text,
  p_body_ar     text DEFAULT NULL,
  p_body_en     text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id   uuid DEFAULT NULL,
  p_action_url  text DEFAULT NULL,
  p_metadata    jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid;
  v_enabled    public.notification_type[];
  v_id         uuid;
BEGIN
  -- جلب company المستخدم
  SELECT company_id INTO v_company_id FROM public.users_profile WHERE id = p_user_id;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'لا يوجد ملف لهذا المستخدم';
  END IF;

  -- فحص التفضيلات: هل النوع مُفعَّل؟
  SELECT enabled_types INTO v_enabled
    FROM public.notification_preferences
   WHERE user_id = p_user_id;

  -- إذا لا توجد تفضيلات، نعتبر كل الأنواع مُفعَّلة (سلوك الافتراضي)
  IF v_enabled IS NOT NULL AND NOT (p_type = ANY(v_enabled)) THEN
    RETURN NULL;  -- المستخدم غلّق هذا النوع
  END IF;

  -- إنشاء الإشعار
  INSERT INTO public.notifications (
    company_id, user_id, type,
    title_ar, title_en, body_ar, body_en,
    entity_type, entity_id, action_url, metadata
  ) VALUES (
    v_company_id, p_user_id, p_type,
    p_title_ar, p_title_en, p_body_ar, p_body_en,
    p_entity_type, p_entity_id, p_action_url, p_metadata
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

-- -----------------------------------------------------------------------------
-- 5) دالة: تعليم الكل كمقروء
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.notifications
     SET read_at = now()
   WHERE user_id = auth.uid()
     AND read_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- -----------------------------------------------------------------------------
-- 6) trigger: عند إسناد وظيفة لفنّي → إشعار
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_notify_job_assigned()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- INSERT جديد مع technician_id، أو UPDATE غيّر technician_id
  IF NEW.technician_id IS NOT NULL AND
     (TG_OP = 'INSERT' OR OLD.technician_id IS DISTINCT FROM NEW.technician_id) THEN
    PERFORM public.fn_notify(
      NEW.technician_id,
      'job_assigned',
      'وظيفة جديدة أُسنِدت إليك',
      'New job assigned to you',
      'الوظيفة #' || COALESCE(NEW.job_no, NEW.id::text),
      'Job #' || COALESCE(NEW.job_no, NEW.id::text),
      'job',
      NEW.id,
      '/my-jobs/' || NEW.id::text
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_jobs_notify_assignment ON public.jobs;
CREATE TRIGGER trg_jobs_notify_assignment
  AFTER INSERT OR UPDATE OF technician_id ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_job_assigned();

-- -----------------------------------------------------------------------------
-- 7) trigger: عند استلام دفعة → إشعار للمحاسبة (مَن لديه payments:view)
--    (لا نُنشئ إشعارات فردية بل نعتمد على Realtime من جدول payments)
-- -----------------------------------------------------------------------------

-- نُلغي هذا للـ over-engineering؛ الـ realtime على payments يكفي.

-- =============================================================================
-- نهاية ترحيل 032
-- =============================================================================
