-- =============================================================================
-- K3 ERP — ترحيل 034
-- المرحلة 8د — تفعيل Realtime على الجداول المطلوبة
--
-- Supabase يستخدم publication اسمها supabase_realtime لبثّ التغييرات.
-- الجداول التي لا تكون عضواً في هذه الـ publication لا تُرسل postgres_changes.
--
-- الجداول التي تحتاج Realtime في K3 ERP:
--   1. notifications        — جرس الإشعارات في الـ topbar
--   2. chat_messages        — رسائل المحادثة الفورية
--   3. chat_threads         — تحديث آخر رسالة في القائمة
--
-- الجداول التي لا تحتاج Realtime (لتقليل الحمل):
--   - jobs, invoices, payments, customers ... (يُحدَّث عبر page reload)
-- =============================================================================

-- إنشاء publication إن لم تكن موجودة (Supabase يُنشئها افتراضياً)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- إضافة الجداول إلى publication
-- ALTER PUBLICATION ... ADD TABLE لا يوجد له IF NOT EXISTS، نستخدم DO block
DO $$
BEGIN
  -- notifications
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  -- chat_messages
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;

  -- chat_threads (لتحديث last_message_at في القائمة الجانبية)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_threads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_threads;
  END IF;
END $$;

-- ملاحظة: REPLICA IDENTITY = DEFAULT يكفي للـ INSERT events.
-- إذا أردنا UPDATE/DELETE events تشمل OLD row كاملاً، نستخدم FULL.
-- لكن هذا يستهلك ذاكرة WAL أكثر، نتجنبه إلا للضرورة.

-- =============================================================================
-- نهاية ترحيل 034
-- =============================================================================
