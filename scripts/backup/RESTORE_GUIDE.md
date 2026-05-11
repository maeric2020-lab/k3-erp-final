# دليل الاستعادة من النسخة الاحتياطية — K3 ERP

## متى نحتاج هذا الدليل؟

ثلاث حالات رئيسية:

1. **استعادة كاملة بعد كارثة**: قاعدة البيانات تالفة أو المشروع على Supabase تأثّر.
2. **استعادة جزئية**: حذف غير مقصود لبيانات (مثلاً مدير حذف عميلاً مع كل وظائفه عبر cascade).
3. **استعادة بيئة staging من إنتاج**: لاستنساخ البيانات لاختبار يدوي.

## ما الذي نسخّناه؟

- **قاعدة البيانات الكاملة** (schema العامّة + كل البيانات)، مضغوطة بـ gzip، يومياً الساعة 3 صباحاً.
- **بيانات buckets** (الأسماء والإعدادات فقط، ليس المحتوى).

## ما الذي **لم** ننسخه احتياطياً؟

- **محتوى buckets** (التوقيعات، مرفقات العقود، مرفقات المحادثات). هذه مهمة لكنها كبيرة الحجم. حلّها مستقبلاً: نسخ نمو-تزايدي يومي.
- **بيانات auth schema**: مُدارة من Supabase نفسه، يتم نسخها احتياطياً تلقائياً من قِبَل Supabase.

## استعادة كاملة

```bash
# 1) جلب أحدث نسخة احتياطية من bucket 'backups'
curl -sS -o latest.sql.gz \
  -X GET "${SUPABASE_URL}/storage/v1/object/backups/k3-db-LATEST.sql.gz" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"

gunzip latest.sql.gz

# 2) تجهيز قاعدة بيانات نظيفة (مشروع Supabase جديد أو إعادة تهيئة)
#    افتح SQL Editor في dashboard وشغّل:
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

# 3) تطبيق الترحيلات (لإعادة بناء الدوال والـ extensions)
supabase db push

# 4) استعادة البيانات (تخطّي إنشاء schema العامّة لأنها موجودة الآن)
psql "$SUPABASE_DB_URL" \
  -v ON_ERROR_STOP=1 \
  --single-transaction \
  -f latest.sql

# 5) إعادة بناء الإحصاءات
psql "$SUPABASE_DB_URL" -c "ANALYZE;"
```

## استعادة جزئية (جدول واحد)

السيناريو: مدير حذف عميلاً بطريق الخطأ، ومعه 5 وظائف و3 فواتير.

```bash
# 1) جلب نسخة الأمس
curl -sS -o yesterday.sql.gz \
  -X GET "${SUPABASE_URL}/storage/v1/object/backups/k3-db-${YESTERDAY}_030000.sql.gz" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}"

gunzip yesterday.sql.gz

# 2) استخراج الجدول (أو الجداول) المراد استعادتها
pg_restore -t customers -t jobs -t invoices yesterday.sql > partial.sql

# 3) إنشاء قاعدة بيانات مؤقتة
createdb k3_temp_restore
psql k3_temp_restore -f yesterday.sql

# 4) نسخ السطور المفقودة فقط
psql k3_temp_restore -c "
COPY (SELECT * FROM customers WHERE id = 'CUSTOMER_ID') TO STDOUT
" | psql "$SUPABASE_DB_URL" -c "COPY customers FROM STDIN"

# 5) كرّر الخطوة 4 لكل جدول مرتبط (jobs, invoices, document_lines, payments)

# 6) تنظيف
dropdb k3_temp_restore
```

## استنساخ إنتاج → staging

```bash
# 1) جلب أحدث نسخة من إنتاج
curl -sS -o prod.sql.gz \
  -X GET "${PROD_SUPABASE_URL}/storage/v1/object/backups/k3-db-LATEST.sql.gz" \
  -H "apikey: ${PROD_SERVICE_ROLE_KEY}"

gunzip prod.sql.gz

# 2) تجهيز staging نظيف
psql "$STAGING_DB_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
supabase db push --db-url "$STAGING_DB_URL"

# 3) استعادة
psql "$STAGING_DB_URL" --single-transaction -f prod.sql

# 4) إخفاء البيانات الحسّاسة (anonymisation)
psql "$STAGING_DB_URL" <<EOF
UPDATE public.users_profile
   SET email = 'staging-' || id || '@k3.test',
       phone = NULL
 WHERE email NOT LIKE '%@k3.test';

UPDATE public.customers
   SET phone = NULL,
       notes = NULL;

UPDATE public.maintenance_requests
   SET reported_phone = NULL;
EOF

# 5) ANALYZE
psql "$STAGING_DB_URL" -c "ANALYZE;"
```

## التدريب الدوري على الاستعادة

**مرة كل 3 أشهر**: تنفيذ "drill استعادة" على بيئة staging جديدة لاختبار:
1. هل آخر نسخة احتياطية موجودة فعلاً؟
2. هل تستطيع إنشاء قاعدة بيانات نظيفة وتطبيق الترحيلات بدون أخطاء؟
3. هل بعد الاستعادة، تطبيق الويب يعمل بشكل طبيعي؟ (تشغيل اختبارات E2E عليها)
4. كم استغرقت العملية؟ (الهدف: < 30 دقيقة)

سجِّل النتيجة في `RESTORE_DRILL_LOG.md`.

## مخطط نمو احتياطي القاعدة

| الجدول | تقدير 5 سنوات | حجم تقديري |
|---|---|---|
| customers | 5,000 صف | < 5 MB |
| jobs | 50,000 صف | ~30 MB |
| document_lines | 200,000 صف | ~100 MB |
| invoices | 40,000 صف | ~20 MB |
| audit_log | 500,000 صف | ~250 MB |
| chat_messages | 100,000 صف | ~50 MB |
| **إجمالي قبل الضغط** | | **~500 MB** |
| **بعد ضغط gzip** | | **~70 MB** |

النسخ اليومية لـ 30 يوم = 70 MB × 30 = ~2 GB. مقبول جداً ضمن خطة Supabase.

## نقاط مهمّة

- **عدم استعادة auth schema**: الـ pg_dump يستثني `auth` لأن Supabase تديره. استعادتها قد تكسر تكامل المصادقة.
- **التعامل مع التكامل المرجعي**: عند الاستعادة الجزئية لا تنسَ ترتيب الـ FOREIGN KEYs. مثلاً: استعادة `customers` قبل `jobs` قبل `document_lines`.
- **مفاتيح UUID لا تتغيّر**: لا حاجة لإعادة الربط، الـ FKs ستجد جذورها.
- **التريغرات تشتغل أثناء الاستعادة**: `--single-transaction` يضمن إن فشل أي شيء، يُلغى كل الاستيراد.
