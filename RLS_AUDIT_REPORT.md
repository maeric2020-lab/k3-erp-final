# مراجعة RLS — K3 ERP (المرحلة 7أ)

## ملخّص النتائج

تم فحص كل الجداول الـ 39 في schema العامّة. النتيجة:
- ✅ كل الجداول لديها `ENABLE ROW LEVEL SECURITY`.
- ✅ كل الجداول لديها سياسة واحدة على الأقل.
- ⚠️ ثلاث ثغرات منطقية اكتُشفت وتم إصلاحها في ترحيل 029.
- ✅ كل الدوال `SECURITY DEFINER` (15 دالة) تستخدم `SET search_path = public, pg_temp`.
- ✅ كل buckets storage الثلاثة محمية بسياسات RLS.

## الثغرات المُصلَحة

### الثغرة 1 — تعارض في أسماء شاشات قوالب الصلاحيات

**المشكلة**: المرحلة 1 سجّلت شاشة `roles_templates` وكتبت سياسات RLS على جدولَي `permission_templates` و`permission_template_items` تستخدم هذا الاسم. المرحلة 5 سجّلت شاشة جديدة باسم `permission_templates` وبَنَت واجهة المستخدم عليها.

**النتيجة العملية**: مدير لديه `permission_templates:view, edit` لا يرى أي قالب لأن RLS يفحص `roles_templates:view`. فقط super-admin يستطيع استخدام صفحة قوالب الصلاحيات.

**الإصلاح**:
- ترحيل بيانات الأذونات والقوالب من `roles_templates` إلى `permission_templates`.
- حذف الشاشة القديمة.
- إعادة كتابة السياستين باستخدام الاسم الصحيح.

### الثغرة 2 — شاشة `users_permissions` غير موجودة

**المشكلة**: سياسات `user_screen_permissions` تفحص شاشة `users_permissions`، لكن هذه الشاشة لم تُسجَّل في الـ seed. بدلاً منها، المرحلة 5 سجّلت شاشة `users` لإدارة المستخدمين.

**النتيجة العملية**: نفس المشكلة السابقة — RLS يفحص اسماً غير موجود فعلياً، فقط super-admin يستطيع تعديل الأذونات.

**الإصلاح**: ترحيل البيانات + إعادة كتابة السياسات لتفحص `users:view, edit`.

### الثغرة 3 — تكرار شاشة تقرير أداء الفنيين

**المشكلة**: المرحلة 1 سجّلت `report_technician_performance`، المرحلة 6 سجّلت `report_technician_perf` (مع رابط `/reports/technician-performance`). الواجهة تستخدم الاسم الجديد، لكن seed القديم كان مكرراً في قائمة الشاشات.

**الإصلاح**: ترحيل البيانات + حذف الاسم القديم.

## ثغرات بسيطة ولكنها مهمّة

### `audit_log` — سياسة مكررة

المرحلة 1 أنشأت `audit_log_super_admin` (super-admin فقط). المرحلة 5 أنشأت `audit_log_select_admin` (super-admin أو من لديه `audit_log:view`) لكنها لم تُسقِط القديمة. السياسات في PostgreSQL تجمع بـ OR، فالأمن لم يتأثر، لكن المنطق فوضى.

**الإصلاح**: حذف `audit_log_super_admin` في الترحيل.

### bucket `signatures` بدون RLS واضح

bucket توقيعات الفنيين أُنشئ في المرحلة 1 لكن لم يُكتب له سياسة. Supabase الافتراضية تمنع كل شيء حتى تُكتب سياسة، لكن لم يكن واضحاً إن كان API الخادم يستخدم service_role أم anon key.

**الإصلاح**: إضافة سياستين صريحتين:
- قراءة: super-admin، أو من لديه `jobs:view`، أو الفني المسؤول عن الوظيفة المرتبطة.
- كتابة مباشرة من العميل: ممنوعة (الـ API الخادم يستخدم service_role).

## الجداول والسياسات — ملخّص نهائي

### مجموعة 1: الإدارة (admin)

| الجدول | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `users_profile` | self أو admin أو `users:view` | self على بعض الحقول، admin على الكل |
| `screens` | كل authenticated | super-admin فقط |
| `user_screen_permissions` | self أو `users:view` | `users:edit` |
| `permission_templates` | `permission_templates:view` | `permission_templates:edit` |
| `permission_template_items` | `permission_templates:view` | `permission_templates:edit` |
| `audit_log` | `audit_log:view` | لا inserts من العميل (triggers فقط) |
| `company_settings` | كل authenticated | `company_settings:edit` |
| `numbering_sequences` | كل authenticated | `numbering_sequences:edit` |

### مجموعة 2: البيانات الرئيسية

كلها بالنمط: قراءة لكل authenticated نشط، تعديل بإذن الشاشة المقابلة.

### مجموعة 3: العمليات

| الجدول | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `customers`, `customer_sites`, `customer_machines` | إذن الشاشة | إذن الشاشة |
| `contracts`, `contract_machines`, `contract_clauses` | إذن الشاشة | إذن الشاشة |
| `maintenance_requests` | إذن الشاشة | إذن الشاشة |
| `jobs` | إذن الشاشة أو الفني المسؤول | الفني (انتقالات الحالة) أو admin |
| `document_lines` | عبر الجدول الأم (job/quotation/...) | نفس الشيء |

### مجموعة 4: المالية

كلها مقيّدة بـ `quotations`/`invoices`/`payments` على التوالي. الـ triggers تحدّث `amount_paid` و`balance` تلقائياً.

### مجموعة 5: المحادثات

عضوية الـ thread هي الأساس. غير الأعضاء لا يرون أي شيء، حتى وجود الـ thread نفسه.

## الدوال SECURITY DEFINER

ست عشرة دالة بهذا الوصف، كلها تستخدم `SET search_path = public, pg_temp`:

| الدالة | الغرض |
|---|---|
| `bootstrap_admin` | إنشاء أول super-admin عبر `/setup` |
| `fn_is_super_admin` | فحص دور المستخدم الحالي |
| `fn_has_screen_permission` | فحص إذن الشاشة |
| `fn_set_user_active` | تفعيل/تعطيل (مع حماية الذات) |
| `fn_apply_template_to_user` | تطبيق قالب صلاحيات |
| `fn_user_permission_grid` | شبكة أذونات للواجهة |
| `compute_line_pricing` | حساب سعر السطر (المصدر الوحيد للأسعار) |
| `fn_compressor_bracket_price` | سعر تركيب الكومبريسور |
| `fn_generate_invoice_for_job` | توليد فاتورة عند إكمال وظيفة |
| `fn_jobs_status_transition` | TRIGGER على انتقال حالة الوظيفة |
| `fn_chat_create_or_get_dm` | إنشاء/جلب DM 1-إلى-1 |
| `fn_set_updated_at` | TRIGGER لتحديث updated_at |
| `fn_chat_messages_bump_thread` | TRIGGER لتحديث last_message_at |
| `fn_invoice_recalc` | TRIGGER لإعادة حساب الفاتورة |
| `fn_seed_default_clauses` | بنود العقد الافتراضية |
| `fn_request_to_job` | تحويل طلب صيانة إلى وظيفة |

كل واحدة تتحقق صراحةً من إذن المتصل قبل تنفيذ أي عملية ذات امتيازات.

## buckets في storage

| bucket | عام؟ | حد الحجم | ملاحظات |
|---|---|---|---|
| `signatures` | لا | 5 MB | RLS مُضافة في 029 |
| `contract-attachments` | لا | 25 MB | محمي عبر contracts RLS |
| `chat-attachments` | لا | 25 MB | محمي عبر chat_thread_members |

## مخطط التحقق المستقبلي

اختبار E2E مقترح للأمن:
1. إنشاء مستخدم بدون أي أذونات → التأكد من عدم رؤية أي بيانات.
2. منحه `customers:view` فقط → التأكد من رؤية العملاء وعدم رؤية العقود.
3. منحه شاشة وظائف الفني `jobs_my:view` → التأكد من رؤية وظائفه فقط.
4. محاولة قراءة `audit_log` بدون إذن → 403.
5. محاولة تعطيل آخر super-admin → خطأ من `fn_set_user_active`.
6. محاولة إرسال رسالة في thread ليس عضواً فيه → RLS يرفض.
7. محاولة رفع ملف بمسار خاطئ في chat-attachments → RLS يرفض.

## التشديدات المتبقية للمرحلة 7ب (الاختبارات)

- E2E للسيناريوهات أعلاه باستخدام Playwright.
- اختبار تكاملي على RPCs الـ 19 عبر استدعاء مباشر بـ supabase-js.
- مراجعة logs على الإنتاج بعد الإطلاق للبحث عن خطأ "permission denied" غير متوقع.
