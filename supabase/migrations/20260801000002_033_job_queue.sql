-- =============================================================================
-- K3 ERP — ترحيل 033
-- المرحلة 8ج — Job Queue
--
-- المشكلة: توليد الفواتير، الإيميلات، التقارير الثقيلة تحدث inline في
-- API requests، فإذا فشلت لا أحد يعرف. الحل: queue + worker.
--
-- البنية:
--   - job_queue: جدول الـ queue
--   - الحالات: pending → running → done | failed
--   - retry تلقائي مع exponential backoff
--   - leasing: worker يحجز job قبل تنفيذه (لمنع التزاحم بين عدة workers)
--
-- التشغيل: cron job كل دقيقة يستدعي /api/queue/process
-- =============================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'queue_job_status') THEN
    CREATE TYPE public.queue_job_status AS ENUM ('pending', 'running', 'done', 'failed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.job_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid REFERENCES public.companies(id),
  -- نوع المهمة (يحدّد المُعالج)
  task_type       text NOT NULL,           -- 'generate_invoice' | 'send_email' | 'recompute_report' ...
  -- payload: ما تحتاجه المهمة من بيانات
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- أولوية (الأقل = الأعلى أولوية)
  priority        integer NOT NULL DEFAULT 100,
  -- جدولة: لا تُشغَّل قبل هذا الوقت
  scheduled_for   timestamptz NOT NULL DEFAULT now(),
  -- الحالة
  status          public.queue_job_status NOT NULL DEFAULT 'pending',
  -- محاولات
  attempts        integer NOT NULL DEFAULT 0,
  max_attempts    integer NOT NULL DEFAULT 5,
  -- leasing: من حجز هذه المهمة (worker_id) ومتى تنتهي صلاحية الحجز
  locked_by       text,
  locked_until    timestamptz,
  -- نتيجة
  last_error      text,
  result          jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_queue_pending ON public.job_queue (priority, scheduled_for)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_queue_running ON public.job_queue (locked_until)
  WHERE status = 'running';
CREATE INDEX IF NOT EXISTS idx_queue_company ON public.job_queue(company_id);

ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

-- لا قراءة مباشرة من العميل (خادم فقط عبر service_role أو الدوال أدناه)
DROP POLICY IF EXISTS queue_admin_only ON public.job_queue;
CREATE POLICY queue_admin_only ON public.job_queue FOR SELECT TO authenticated
  USING (
    company_id = public.fn_current_company_id()
    AND public.fn_is_super_admin()
  );

-- -----------------------------------------------------------------------------
-- دوال helper
-- -----------------------------------------------------------------------------

/**
 * إضافة مهمة للـ queue.
 * يُستدعى من API routes أو من triggers.
 */
CREATE OR REPLACE FUNCTION public.fn_enqueue(
  p_task_type      text,
  p_payload        jsonb DEFAULT '{}'::jsonb,
  p_priority       integer DEFAULT 100,
  p_scheduled_for  timestamptz DEFAULT now(),
  p_max_attempts   integer DEFAULT 5
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.job_queue (
    company_id, task_type, payload, priority, scheduled_for, max_attempts
  ) VALUES (
    public.fn_current_company_id(), p_task_type, p_payload, p_priority, p_scheduled_for, p_max_attempts
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

/**
 * يحجز المهمة التالية للتنفيذ.
 * يستخدم SELECT FOR UPDATE SKIP LOCKED لتجنب التزاحم بين workers.
 *
 * يُعيد row واحد أو لا شيء (المعالج يُعيد المحاولة لاحقاً).
 */
CREATE OR REPLACE FUNCTION public.fn_dequeue(
  p_worker_id   text,
  p_lock_for_ms integer DEFAULT 60000   -- 60 ثانية
)
RETURNS TABLE (
  id          uuid,
  task_type   text,
  payload     jsonb,
  attempts    integer
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  -- 1) إعادة المهام المنتهية صلاحية حجزها إلى pending
  UPDATE public.job_queue
     SET status = 'pending',
         locked_by = NULL,
         locked_until = NULL
   WHERE status = 'running'
     AND locked_until < now();

  -- 2) اختيار + قفل أعلى مهمة pending
  SELECT q.id INTO v_job_id
    FROM public.job_queue q
   WHERE q.status = 'pending'
     AND q.scheduled_for <= now()
   ORDER BY q.priority ASC, q.scheduled_for ASC
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  IF v_job_id IS NULL THEN
    RETURN;
  END IF;

  -- 3) تحديث الحالة
  UPDATE public.job_queue
     SET status = 'running',
         locked_by = p_worker_id,
         locked_until = now() + (p_lock_for_ms || ' milliseconds')::interval,
         attempts = attempts + 1,
         started_at = COALESCE(started_at, now())
   WHERE id = v_job_id;

  RETURN QUERY
    SELECT q.id, q.task_type, q.payload, q.attempts
      FROM public.job_queue q
     WHERE q.id = v_job_id;
END $$;

/**
 * تأكيد إكمال مهمة.
 */
CREATE OR REPLACE FUNCTION public.fn_complete_job(
  p_job_id  uuid,
  p_result  jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.job_queue
     SET status = 'done',
         completed_at = now(),
         locked_by = NULL,
         locked_until = NULL,
         result = p_result
   WHERE id = p_job_id;
END $$;

/**
 * تسجيل فشل مهمة.
 * - إذا attempts < max_attempts: تعود إلى pending مع backoff
 * - إذا تجاوزت الحد: تنتقل إلى failed نهائياً
 */
CREATE OR REPLACE FUNCTION public.fn_fail_job(
  p_job_id    uuid,
  p_error_msg text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempts     integer;
  v_max_attempts integer;
  v_backoff_sec  integer;
BEGIN
  SELECT attempts, max_attempts INTO v_attempts, v_max_attempts
    FROM public.job_queue WHERE id = p_job_id;

  IF v_attempts >= v_max_attempts THEN
    -- فشل نهائي
    UPDATE public.job_queue
       SET status = 'failed',
           completed_at = now(),
           locked_by = NULL,
           locked_until = NULL,
           last_error = p_error_msg
     WHERE id = p_job_id;
  ELSE
    -- exponential backoff: 30s، 60s، 2m، 4m، 8m
    v_backoff_sec := LEAST(30 * power(2, v_attempts - 1)::integer, 3600);
    UPDATE public.job_queue
       SET status = 'pending',
           locked_by = NULL,
           locked_until = NULL,
           last_error = p_error_msg,
           scheduled_for = now() + (v_backoff_sec || ' seconds')::interval
     WHERE id = p_job_id;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- استبدال inline توليد الفاتورة بـ enqueue (اختياري — يبقى الـ inline يعمل
-- لكن نُضيف خيار async)
-- -----------------------------------------------------------------------------

-- هذا التغيير اختياري — في 8ج نُبقي على inline لتجنب breaking changes،
-- ونوفّر الـ async option كميزة إضافية.

-- =============================================================================
-- نهاية ترحيل 033
-- =============================================================================
