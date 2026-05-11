# التدقيق المعماري الشامل — K3 ERP
**تاريخ التدقيق**: 10 مايو 2026 | **الإصدار المُدقَّق**: نهاية المرحلة 7

> هذا التقرير صريح. لن أُجمّل النتائج. النظام يعمل، لكن الجاهزية الإنتاجية الحقيقية تتطلّب إصلاح ما يلي قبل أي ميزة جديدة.

---

## 🔴 الأخطاء الحرجة (Build Breakers)

هذه أخطاء يجب أن تكون قد كسرت `tsc --noEmit` لو شُغِّل، وتعني أن الـ build لم يُختبر فعلياً منذ المرحلة 5.

### B-1: تكرار تصدير `ScreensRepository`
**الموقع**: `packages/repositories/src/index.ts` السطر 9 + سياق `admin.repository.ts`

`ScreensRepository` معرَّف في ملفّين منفصلين (`screens.repository.ts` و`admin.repository.ts`) وكلاهما مُصدَّر من `index.ts`. هذا خطأ TypeScript معروف: `Module exports the same name twice`.

**السبب الجذري**: في المرحلة 5 أنشأتُ `admin.repository.ts` باعتقاد أنه ملف جديد، لكن `screens.repository.ts` كان موجوداً منذ المرحلة 1. لم أتحقق.

### B-2: تكرار تصدير `CompanySettings` (نوع)
**الموقع**: `index.ts` السطر 8 و140

النوع مُصدَّر مرتين، مرة كـ `export {}` ومرة كـ `export type {}`. سيكسر الـ build.

### B-3: تكرار تصدير `UserScreenPermission`
معرَّف في `permissions.repository.ts` و`admin.repository.ts`. غير مُصدَّر من `index.ts` لذا لا يكسر الـ build، لكنه ديون تقنية مباشرة.

---

## 🟠 الديون التقنية المتراكمة

### D-1: `as any` × 146
**التركّز الأعلى**:
- `reports.repository.ts`: 8 (كل استدعاء RPC)
- `simple.importers.ts`: 7
- `_base.ts`: 6 (في الـ generic CRUD)
- `master-handlers.ts`: 6

**السبب**: الأنواع في `database.types.ts` مكتوبة يدوياً. عند استدعاء `db.rpc('fn_x', args)`، TypeScript لا يستنتج أن `'fn_x'` موجود في الـ Functions interface، لذا يجب التحويل.

**الحل**:
- توليد الأنواع من Supabase: `pnpm db:gen-types` (موجود في scripts، لم يُشغَّل)
- بعد التوليد، حذف `as any` من كل استدعاءات RPC

### D-2: `Insert: any` و `Update: any` في Database types
**الموقع**: `database.types.ts` السطر 461، 462

```ts
permission_templates: { Row: {...}; Insert: any; Update: any };
permission_template_items: { Row: {...}; Insert: any; Update: any };
```

ثقبان يفقدان كل الفائدة من نظام الأنواع لهذه الجداول.

### D-3: 5 صفحات تستدعي Supabase مباشرةً (تكسر القاعدة المعمارية)

```
apps/web/app/(authed)/sales/quotations/[id]/page.tsx
apps/web/app/(authed)/finance/invoices/[id]/page.tsx
apps/web/app/(authed)/operations/jobs/[id]/page.tsx
apps/web/app/(authed)/operations/requests/[id]/page.tsx
apps/web/app/api/invoices/[id]/route.ts
```

القاعدة المعمارية الموثَّقة: **"المستودعات هي الطبقة الوحيدة التي تلامس Supabase"**. هذه الـ 5 ملفات تكسرها.

### D-4: 32 من 92 مسار API بدون `try/catch`
أي ثلث الـ API يكشف stack traces الكاملة عند أي خطأ. مشكلة أمنية (تسريب معلومات داخلية) ومشكلة UX (المستخدم يرى شاشة بيضاء).

### D-5: 29 من 92 مسار API بدون validation
المسارات GET غالباً، لكن بعض POST/PATCH أيضاً. أي input غير محقَّق = ثقب.

---

## 🔴 ثغرات الجاهزية الإنتاجية

### P-1: لا يوجد ولا ملف `loading.tsx` ولا `error.tsx` في كل المشروع

**النتيجة**: 
- كل صفحة تنتظر الخادم بدون أي مؤشّر تحميل
- أي خطأ يعرض صفحة "Something went wrong" الافتراضية لـ Next.js (بدون رسالة، بدون زر إعادة محاولة)
- لا يوجد `not-found.tsx` لـ 404 مخصّصة

### P-2: لا يوجد نظام Toast/Notifications
صفر استخدام لـ toast في 92 مسار + 54 صفحة. كل رسائل النجاح/الفشل تظهر كـ Alert محلّية داخل الصفحة، أو لا تظهر أصلاً.

### P-3: لا يوجد env validation
10 استخدامات لـ `process.env.X` في الكود، صفر تحقّق مركزي. متغير ناقص = خطأ runtime مبهم في الإنتاج.

### P-4: لا يوجد rate limiting
صفر مرجع. مسار `/api/chat/upload` يقبل أي عدد من الطلبات بأي حجم. مهاجم يستطيع رفع 1000 ملف × 25MB في دقيقة وملء bucket كامل.

### P-5: validation رفع الملفات منقوص
في `/api/chat/upload`:
- ✅ يفحص `file.size` ضد 25MB
- ❌ يقبل أي MIME type (لا قائمة بيضاء)
- ❌ لا يفحص magic bytes (مهاجم يرفع `.exe` بامتداد `.jpg`)
- ❌ لا يطهّر اسم الملف من رموز خطرة (يستخدم `safeName` لكن حد 200 حرف فقط)

### P-6: لا يوجد security headers
`next.config.mjs` بدون CSP، X-Frame-Options، X-Content-Type-Options، Strict-Transport-Security. النظام مكشوف لـ clickjacking ومحاولات XSS.

### P-7: لا يوجد centralized logging
فحص `console.log` يُظهر استخداماً متناثراً. لا يوجد wrapper مثل `logger.info` يُرسل إلى Sentry/Datadog. أخطاء الإنتاج تختفي.

### P-8: لا يوجد idempotency على POST مالية حسّاسة
`/api/payments` يقبل دفعة بـ "تسجيل دفع". إذا ضغط المستخدم مرتين بسبب lag، تُسجَّل دفعتان. لا يوجد `Idempotency-Key`.

---

## 🟡 مخاطر الأداء

### Pf-1: pagination غير شامل
- `users-profile.repository.ts.listAll()` بحد 500
- `permissions.repository` يُحمّل كل الأذونات
- صفحات القائمة (13 منها) لها pagination، لكن المستودعات لا ترجع `total_count` متّسقاً

### Pf-2: دالة `fn_chat_thread_summary` تُنفَّذ كاملةً عند كل تحميل لـ `/chat`
عند 100 thread وأكثر من 1000 رسالة لكل thread، الـ subquery `last_msgs` بـ `DISTINCT ON` يصبح بطيئاً. الفهرس `idx_chat_messages_thread_created` يساعد لكنه ليس كافياً عند آلاف المستخدمين.

### Pf-3: لا توجد view materialized لتقارير ثقيلة
`fn_report_payment_aging` يُحسب من الصفر كل مرة. عند 50,000 فاتورة، حتى مع الفهارس قد يستغرق 500ms+.

### Pf-4: `useEffect` × 19 بدون cleanup صريح
الفحص أظهر استخدامات `useEffect` في 19 موقعاً. بعضها بدون return cleanup، خاصة في أماكن تشترك على Realtime.

---

## 🔴 مخاطر الأمن

### S-1: جدول `jobs` بدون `created_by`/`updated_by`
الميزة الأساسية في النظام (الوظائف) لا تتتبَّع من أنشأها أو من عدّلها. سجل التدقيق يلتقط الانتقالات (عبر trigger)، لكن إذا عدّل المسؤول حقلاً عادياً (notes مثلاً) لا يُسجَّل من فعلها.

### S-2: لا يوجد session timeout للمسؤولين
المرحلة 1 ضبطت Supabase auth بالافتراضي. الجلسة تستمر 60 يوم. مسؤول مالية ينسى تسجيل الخروج على جهاز مشترك = ثغرة.

### S-3: middleware لا يضع headers أمنية
لا CSP يحمي من XSS، لا Permissions-Policy.

### S-4: bucket `signatures` كان بدون RLS صريح حتى المرحلة 7
أُصلح في ترحيل 029. لكن كل التوقيعات المرفوعة قبل ذلك ربما كانت قابلة للوصول العام (يحتاج فحص bucket).

### S-5: لا يوجد ثيقة threat model
لم نرسم سيناريوهات: "ماذا لو سُرّبت service_role key؟"، "ماذا لو فُك تشفير الكوكيز؟"، "ماذا عن وصول internal threat (موظف غاضب)؟".

---

## 🟠 مشاكل التوسّع (Scalability)

### Sc-1: لا يوجد `company_id` في أي جدول
**هذا أكبر تحدٍّ**. النظام مصمَّم لشركة واحدة (K3) فقط. إذا أرادت Anthropic بيعه لشركات أخرى، تحتاج إضافة `company_id` على ~30 جدولاً + إعادة كتابة كل سياسات RLS.

أوصي بإضافة `company_id uuid` (مع FK لجدول جديد `companies`) **الآن** قبل أن تكبر البيانات. الترحيل لاحقاً صعب جداً.

### Sc-2: لا يوجد job queue
- توليد الفواتير التلقائي يحدث inline داخل `JobsService.markJobComplete`
- لا يوجد retry إذا فشل
- إذا فشل `fn_generate_invoice_for_job`، الوظيفة تكتمل والفاتورة لا تُنشأ، ولا أحد يعرف

### Sc-3: لا يوجد notifications system
- المحادثات تستخدم Realtime (يعمل فقط للمستخدم النشط في التبويب)
- إذا أُسنِدت وظيفة لفنّي بينما تطبيقه مغلق، لا يعرف
- لا يوجد إيميل تلقائي عند تجاوز فاتورة استحقاقها
- لا Web Push

### Sc-4: لا offline support للفنيين
الفنّي في الميدان قد يفقد الإشارة. الآن: التطبيق يفشل ببساطة. لا cache للوظائف المُسنَدة، لا queue للإجراءات المؤجَّلة، لا توقيع يُحفَظ محلياً.

### Sc-5: واجهة الموبايل ليست PWA
لا manifest، لا service worker، لا أيقونة "Add to Home Screen". الفنّي يفتح URL في المتصفح كل مرة.

---

## 📊 ملخّص الإحصاءات

| المقياس | القيمة | تقييم |
|---|---|---|
| إجمالي الملفات | 331 | معقول |
| الترحيلات | 30 | ✅ |
| المستودعات | 19 | ✅ |
| API routes | 92 | ✅ |
| الصفحات | 54 | ✅ |
| `as any` | 146 | 🔴 |
| `loading.tsx` / `error.tsx` | 0 / 0 | 🔴 |
| API بـ try/catch | 60/92 (65%) | 🟠 |
| API بـ zod validation | 63/92 (68%) | 🟠 |
| `company_id` | 0 جدول | 🔴 |
| pagination صفحات | 13/54 (24%) | 🟠 |
| toast notifications | 0 | 🔴 |
| security headers | 0 | 🔴 |
| rate limiting | 0 | 🔴 |
| env validation | 0 | 🔴 |

---

## 🛠 خطة الإصلاح المُقترَحة (المرحلة 8)

أقترح تقسيم المرحلة 8 إلى أربع مراحل فرعية، تُنفَّذ **بالترتيب** قبل أي ميزة جديدة:

### 8أ — إصلاح ما يكسر الـ Build (ساعة عمل)
- B-1, B-2, B-3: حذف التصديرات المكررة
- D-2: ملء `Insert`/`Update` للجداول الناقصة
- إضافة سكربت `pnpm verify` يجمع `typecheck + lint + test` كـ smoke test
- توليد `database.types.ts` تلقائياً من Supabase

### 8ب — البنية التحتية للإنتاج (أسبوع)
- env validation مركزي (zod schema)
- Toast system (Sonner أو react-hot-toast)
- `loading.tsx` و`error.tsx` و`not-found.tsx` لكل route group
- Centralized logger (wrapper حول console + Sentry hook)
- Security headers في middleware
- Rate limiter (Upstash Redis أو in-memory مع TTL)
- File upload validation (MIME whitelist + magic bytes + filename sanitization)
- Idempotency key على POST المالية

### 8ج — التوسّع المستقبلي (أسبوعان)
- إضافة `companies` + `company_id` على 30 جدولاً (مع foreign key constraint قابل للتعطيل)
- RLS مُحدَّث ليُقيّد بـ `company_id = (SELECT company_id FROM users_profile WHERE id = auth.uid())`
- نظام إشعارات: جدول `notifications` + قناة Realtime + endpoint Web Push
- جدول `job_queue` + worker بسيط للمهام المؤجَّلة (توليد الفواتير، الإيميلات)

### 8د — قدرات الفنّي الميدانية (أسبوع)
- PWA manifest + service worker
- IndexedDB cache للوظائف المُسنَدة
- Offline action queue (التوقيعات، انتقالات الحالة)
- Sync تلقائي عند العودة للاتصال

### اختياري — التنظيف العميق (يومان)
- حذف `as any` من 146 موقع بعد توليد الأنواع
- نقل 5 الـ direct supabase calls إلى مستودعات
- `created_by`/`updated_by` على جدول `jobs`
- إضافة `total_count` لكل دوال `list*` في المستودعات

---

## 🎯 توصياتي الشخصية

**أهم قرار**: قبل أي ميزة جديدة، نفّذ **8أ** (إصلاح الـ build). لا يمكن أن يستمرّ التطوير على بنية لا تُجمَّع.

**القرار الثاني**: نفّذ **8ب** (البنية التحتية). لأن إضافتها لاحقاً تعني إعادة كتابة كل الـ API routes الحالية. الآن لدينا 92 routes — في المرحلة 12 ستكون 200.

**القرار الثالث**: نفّذ **8ج** الجزء الأول (`company_id`) إذا كان ثمّة احتمال ولو 10% أن يُستخدم النظام لشركة ثانية. الترحيل لاحقاً مع 1 مليون صف هو كابوس.

**يمكن تأجيله**: 8د (PWA/Offline) إذا كان فنّيو K3 لديهم اتصال 4G مستقر دائماً في الكويت. UAT سيحدّد هذا.

---

## ✅ ما يعمل بشكل جيّد

ليس كل شيء سيئاً. الأشياء التالية بُنيت صحيحاً:

- **`compute_line_pricing`** هي مصدر أسعار وحيد فعلاً، لا أسعار مدفونة في الكود
- **RLS هو مصدر الحقيقة** في الأمن، لا توجد regex على client
- **18 ترحيلاً بـ idempotent** (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
- **bilingual `_ar`/`_en`** متّسق على كل عمود نصّي
- **انتقالات حالة الوظيفة عبر trigger** — الفنّي لا يختار يدوياً
- **CSV export بـ UTF-8 BOM** يعمل في Excel-Arabic

النظام له هيكل سليم. المشكلة في **التشطيبات الإنتاجية**، لا في الأساس.

---

## 🤝 اقتراح لخطوتنا التالية

أنتظر قرارك على:

**(أ)** المضيّ بترتيبي المقترح: 8أ → 8ب → 8ج → 8د
**(ب)** ترتيب مختلف (مثلاً: قفز إلى 8ج company_id فوراً)
**(ج)** البدء فقط بـ 8أ (إصلاح الـ build) ثم نوقف للمراجعة

أنصح بـ **(أ)** لأنه يبني على نفسه: أ تجعل الـ build يعمل، ب تضع الأساس الإنتاجي، ج تُمكّن التوسّع، د يكمل القصة.

قل **أ** أو **ب** أو **ج** ولنبدأ.
