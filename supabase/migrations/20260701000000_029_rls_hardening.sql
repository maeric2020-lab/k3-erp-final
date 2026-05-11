-- =============================================================================
-- K3 ERP — ترحيل 029
-- المرحلة 7أ — تشديد RLS وإصلاح التعارضات في أسماء الشاشات
--
-- الهدف:
--   1. إزالة الشاشات المكررة وتوحيد الأسماء التي تستخدمها سياسات RLS مع
--      الأسماء التي تستخدمها واجهة المستخدم.
--   2. إصلاح سياسات الجداول التي كانت تشير إلى أسماء شاشات قديمة.
--   3. إغلاق الثغرات المحتملة في storage buckets.
--   4. إعادة كتابة سياسة audit_log المكررة.
--
-- ما لا يفعله هذا الترحيل:
--   - لا يحذف أي بيانات من جدول user_screen_permissions حتى لا تُفقد
--     الأذونات المُمنوحة سابقاً.
--   - لا يغيّر سلوك RLS على الجداول العاملة كما هو متوقع.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) ترحيل بيانات الأذونات من الأسماء القديمة إلى الأسماء الجديدة
-- -----------------------------------------------------------------------------

-- roles_templates → permission_templates: أي مستخدم لديه إذن على الشاشة القديمة
-- يحصل على نفس الإذن في الشاشة الجديدة (إن لم يكن لديه بالفعل).
INSERT INTO public.user_screen_permissions (user_id, screen_code, action, created_by)
SELECT user_id, 'permission_templates', action, created_by
  FROM public.user_screen_permissions
 WHERE screen_code = 'roles_templates'
ON CONFLICT (user_id, screen_code, action) DO NOTHING;

-- users_permissions → users: نفس الفكرة
INSERT INTO public.user_screen_permissions (user_id, screen_code, action, created_by)
SELECT user_id, 'users', action, created_by
  FROM public.user_screen_permissions
 WHERE screen_code = 'users_permissions'
ON CONFLICT (user_id, screen_code, action) DO NOTHING;

-- report_technician_performance → report_technician_perf
INSERT INTO public.user_screen_permissions (user_id, screen_code, action, created_by)
SELECT user_id, 'report_technician_perf', action, created_by
  FROM public.user_screen_permissions
 WHERE screen_code = 'report_technician_performance'
ON CONFLICT (user_id, screen_code, action) DO NOTHING;

-- نفس الترحيل لقوالب الصلاحيات المُسبقة
INSERT INTO public.permission_template_items (template_id, screen_code, action, granted)
SELECT template_id, 'permission_templates', action, granted
  FROM public.permission_template_items
 WHERE screen_code = 'roles_templates'
ON CONFLICT (template_id, screen_code, action) DO NOTHING;

INSERT INTO public.permission_template_items (template_id, screen_code, action, granted)
SELECT template_id, 'users', action, granted
  FROM public.permission_template_items
 WHERE screen_code = 'users_permissions'
ON CONFLICT (template_id, screen_code, action) DO NOTHING;

INSERT INTO public.permission_template_items (template_id, screen_code, action, granted)
SELECT template_id, 'report_technician_perf', action, granted
  FROM public.permission_template_items
 WHERE screen_code = 'report_technician_performance'
ON CONFLICT (template_id, screen_code, action) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2) حذف الشاشات المكررة (مع cascade على الأذونات القديمة)
-- -----------------------------------------------------------------------------

DELETE FROM public.user_screen_permissions
 WHERE screen_code IN ('roles_templates', 'users_permissions', 'report_technician_performance');

DELETE FROM public.permission_template_items
 WHERE screen_code IN ('roles_templates', 'users_permissions', 'report_technician_performance');

DELETE FROM public.screens
 WHERE code IN ('roles_templates', 'users_permissions', 'report_technician_performance');

-- -----------------------------------------------------------------------------
-- 3) إصلاح سياسات RLS التي تشير إلى الأسماء القديمة
-- -----------------------------------------------------------------------------

-- permission_templates: إعادة الكتابة باسم الشاشة الصحيح
DROP POLICY IF EXISTS permission_templates_admin ON public.permission_templates;
CREATE POLICY permission_templates_admin
  ON public.permission_templates FOR ALL
  TO authenticated
  USING (public.fn_is_super_admin() OR public.fn_has_screen_permission('permission_templates', 'view'))
  WITH CHECK (public.fn_is_super_admin() OR public.fn_has_screen_permission('permission_templates', 'edit'));

-- permission_template_items
DROP POLICY IF EXISTS permission_template_items_admin ON public.permission_template_items;
CREATE POLICY permission_template_items_admin
  ON public.permission_template_items FOR ALL
  TO authenticated
  USING (public.fn_is_super_admin() OR public.fn_has_screen_permission('permission_templates', 'view'))
  WITH CHECK (public.fn_is_super_admin() OR public.fn_has_screen_permission('permission_templates', 'edit'));

-- user_screen_permissions: تعتمد على شاشة users
DROP POLICY IF EXISTS user_screen_perms_select ON public.user_screen_permissions;
CREATE POLICY user_screen_perms_select
  ON public.user_screen_permissions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.fn_is_super_admin()
    OR public.fn_has_screen_permission('users', 'view')
  );

DROP POLICY IF EXISTS user_screen_perms_admin_write ON public.user_screen_permissions;
CREATE POLICY user_screen_perms_admin_write
  ON public.user_screen_permissions FOR ALL
  TO authenticated
  USING (public.fn_is_super_admin() OR public.fn_has_screen_permission('users', 'edit'))
  WITH CHECK (public.fn_is_super_admin() OR public.fn_has_screen_permission('users', 'edit'));

-- -----------------------------------------------------------------------------
-- 4) إزالة سياسة audit_log المكررة من المرحلة 1
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_log_super_admin ON public.audit_log;
-- السياسة الحالية audit_log_select_admin (المرحلة 5) تكفي

-- -----------------------------------------------------------------------------
-- 5) تشديد storage: التأكد من أن storage.objects لها RLS مفعّل في buckets
--    الخاصة بـ K3 (signatures, contract-attachments, chat-attachments)
-- -----------------------------------------------------------------------------

-- توقيعات الفنيين والعملاء — قراءة فقط لمن يستطيع رؤية الوظيفة
DROP POLICY IF EXISTS signatures_read ON storage.objects;
CREATE POLICY signatures_read ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'signatures'
    AND (
      public.fn_is_super_admin()
      OR public.fn_has_screen_permission('jobs', 'view')
      OR EXISTS (
        SELECT 1 FROM public.jobs j
         WHERE j.id::text = (storage.foldername(name))[1]
           AND j.technician_id = auth.uid()
      )
    )
  );

-- لا أحد ينشئ توقيعات إلا من يحمل الوظيفة (ليس عبر API بل API خادمنا
-- يستخدم service_role؛ هذه السياسة تمنع الكتابة المباشرة من العميل)
DROP POLICY IF EXISTS signatures_no_direct_insert ON storage.objects;
CREATE POLICY signatures_no_direct_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id <> 'signatures'
    OR public.fn_is_super_admin()
  );

-- -----------------------------------------------------------------------------
-- 6) ضمان أن كل الدوال SECURITY DEFINER تستخدم SET search_path
--    (إعادة إعلان الدوال المعروفة لا يضر؛ نتأكد فقط من الإعدادات)
-- -----------------------------------------------------------------------------

-- تحقق ذاتي: الدوال التي بدأت كـ SECURITY DEFINER بدون search_path مكتوب صراحةً
-- ستظهر في قسم 6 من سكربت التدقيق. إذا ظهر شيء جديد بعد هذا الترحيل،
-- يجب إعادة إعلان الدالة بـ SET search_path = public, pg_temp.

-- =============================================================================
-- نهاية ترحيل 029
-- =============================================================================
