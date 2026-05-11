# قائمة فحص جاهزية الإنتاج — K3 ERP

> هذه الوثيقة مرفق لـ `UAT_CHECKLIST.md`. الفرق:
> - **UAT_CHECKLIST**: للاختبار الوظيفي مع فريق K3
> - **PRODUCTION_CHECKLIST** (هذا الملف): للاختبار التقني قبل الإطلاق الفعلي

عند اكتشاف مشكلة، سجّلها في `ISSUES_FOUND.md` (ملف جديد ينشأ في كل جلسة اختبار).

---

## القسم 1 — البناء المحلي

| # | الفحص | الأمر | متوقَّع | الحالة |
|---|---|---|---|---|
| 1.1 | تثبيت dependencies | `pnpm install` | اكتمال بدون أخطاء حمراء | ☐ |
| 1.2 | فحص التكرارات | `pnpm verify:quick` | ✅ لا تكرار | ☐ |
| 1.3 | TypeScript على كل الحزم | `pnpm typecheck` | exit 0 | ☐ |
| 1.4 | Lint | `pnpm lint` | لا أخطاء (تحذيرات OK) | ☐ |
| 1.5 | Production build | `pnpm build` | اكتمال + لا runtime errors | ☐ |
| 1.6 | Production start | `pnpm start` | يستجيب على :3000 | ☐ |

### إذا فشل أي بند:
- 1.1: راجع DEPLOYMENT_GUIDE → "مشاكل أثناء pnpm install"
- 1.5: انسخ الخطأ كاملاً وأرسله للتشخيص

---

## القسم 2 — قاعدة البيانات

| # | الفحص | كيفية التنفيذ | متوقَّع | الحالة |
|---|---|---|---|---|
| 2.1 | تطبيق الترحيلات | `supabase db push` | 34 ترحيل ناجح | ☐ |
| 2.2 | عدد الجداول | `SELECT count(*) FROM pg_tables WHERE schemaname='public'` | ~42 | ☐ |
| 2.3 | عدد الدوال | `SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'` | ~30 | ☐ |
| 2.4 | كل الجداول لها RLS | تشغيل `scripts/rls-audit/audit.sql` | لا جدول بدون RLS | ☐ |
| 2.5 | الـ 18 فهرساً موجودة | `SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'idx_%'` | ≥ 30 (18 من ترحيل 030 + الفهارس الأصلية) | ☐ |
| 2.6 | شركة K3 موجودة | `SELECT * FROM companies WHERE code='K3'` | صف واحد | ☐ |
| 2.7 | Realtime publication مفعَّل | `SELECT * FROM pg_publication_tables WHERE pubname='supabase_realtime'` | 3 جداول على الأقل | ☐ |

---

## القسم 3 — Supabase Storage

| # | الفحص | متوقَّع | الحالة |
|---|---|---|---|
| 3.1 | bucket `signatures` موجود + Private | ✓ | ☐ |
| 3.2 | bucket `contract-attachments` موجود + Private | ✓ | ☐ |
| 3.3 | bucket `chat-attachments` موجود + Private | ✓ | ☐ |
| 3.4 | bucket `backups` موجود (للنسخ) | ✓ | ☐ |
| 3.5 | RLS مفعَّل على `storage.objects` | ✓ | ☐ |

---

## القسم 4 — Vercel Deployment

| # | الفحص | متوقَّع | الحالة |
|---|---|---|---|
| 4.1 | الـ deploy مكتمل بدون أخطاء | Build logs خضراء | ☐ |
| 4.2 | متغيّرات البيئة كاملة | 5 متغيرات على الأقل | ☐ |
| 4.3 | `/setup` يفتح بدون 500 | صفحة إعداد المدير | ☐ |
| 4.4 | إنشاء أوّل مدير ناجح | تحويل لـ /login + إيميل وصل | ☐ |
| 4.5 | تسجيل الدخول ناجح | تحويل لـ /dashboard | ☐ |
| 4.6 | الـ vercel.json معترَف به | Cron settings مرئية في Dashboard | ☐ |

---

## القسم 5 — Security Headers

تحقّق بفتح DevTools → Network → اختر أي request → Headers:

| # | الـ Header | متوقَّع | الحالة |
|---|---|---|---|
| 5.1 | `Content-Security-Policy` | يحوي default-src 'self' | ☐ |
| 5.2 | `X-Frame-Options` | DENY | ☐ |
| 5.3 | `X-Content-Type-Options` | nosniff | ☐ |
| 5.4 | `Referrer-Policy` | strict-origin-when-cross-origin | ☐ |
| 5.5 | `Strict-Transport-Security` | max-age=63072000... (production فقط) | ☐ |

---

## القسم 6 — RLS Validation

نفّذ سيناريوهات الأمن في `e2e/tests/rls.security.spec.ts` يدوياً:

| # | السيناريو | متوقَّع | الحالة |
|---|---|---|---|
| 6.1 | مستخدم بدون أذونات → `/customers` | تحويل لـ /forbidden | ☐ |
| 6.2 | فنّي A لا يرى وظائف فنّي B | قائمة فارغة في `/my-jobs` لـ B | ☐ |
| 6.3 | غير admin يحاول `/admin/audit-log` | تحويل لـ /forbidden | ☐ |
| 6.4 | تعطيل آخر super-admin → خطأ | رسالة "آخر مدير لا يُعطَّل" | ☐ |
| 6.5 | عضو غير thread chat يُحاول الإرسال | فشل الإرسال | ☐ |

---

## القسم 7 — Realtime

| # | الفحص | متوقَّع | الحالة |
|---|---|---|---|
| 7.1 | فتح متصفّحَين بمستخدمَين مختلفَين | كلاهما متصل | ☐ |
| 7.2 | A يُرسل رسالة شات لـ B | تظهر فوراً عند B بدون refresh | ☐ |
| 7.3 | الأدمن يُسند وظيفة لفنّي | جرس الفنّي يُحدَّث + toast | ☐ |
| 7.4 | فحص subscription في DevTools | رؤية WS connection لـ wss://...supabase.co | ☐ |

---

## القسم 8 — PWA

| # | الفحص | كيفية التنفيذ | متوقَّع | الحالة |
|---|---|---|---|---|
| 8.1 | manifest.json يُحمَّل | فتح `/manifest.json` | JSON صالح | ☐ |
| 8.2 | sw.js يُسجَّل | DevTools → Application → SW | "activated" | ☐ |
| 8.3 | "Install app" يظهر على Chrome | بعد دقيقة من التصفح | شارة install | ☐ |
| 8.4 | App يفتح بدون شريط المتصفح | بعد التثبيت | standalone | ☐ |
| 8.5 | Lighthouse PWA score | DevTools → Lighthouse → PWA | ≥ 80 | ☐ |

---

## القسم 9 — Offline support

| # | الفحص | كيفية التنفيذ | متوقَّع | الحالة |
|---|---|---|---|---|
| 9.1 | التطبيق يُحمَّل بدون إنترنت | DevTools → Network → Offline ثم refresh | يفتح dashboard cached | ☐ |
| 9.2 | شارة "غير متصل" تظهر | عند offline | شارة صفراء أعلى الشاشة | ☐ |
| 9.3 | إجراء أثناء offline يُحفَظ | تغيير حالة وظيفة وأنت offline | يُسجَّل في IndexedDB | ☐ |
| 9.4 | المزامنة عند العودة | إعادة تشغيل الإنترنت | toast "تم مزامنة N إجراءات" | ☐ |

---

## القسم 10 — Queue Workers

| # | الفحص | كيفية التنفيذ | متوقَّع | الحالة |
|---|---|---|---|---|
| 10.1 | استدعاء `/api/queue/process` يدوياً | curl مع Authorization Bearer | { processed: N } | ☐ |
| 10.2 | استدعاء `/api/queue/scheduled/daily` | نفس الشيء | { enqueued: [...] } | ☐ |
| 10.3 | فحص جدول job_queue | `SELECT * FROM job_queue ORDER BY created_at DESC LIMIT 10` | صفوف متغيّرة | ☐ |
| 10.4 | مهمة failed لا تتعلّق إلى الأبد | فحص بعد 5 محاولات | status='failed' | ☐ |

---

## القسم 11 — Performance

افتح Lighthouse على `/dashboard` و`/my-jobs`:

| # | المقياس | الهدف | الحالة |
|---|---|---|---|
| 11.1 | Performance score | ≥ 70 | ☐ |
| 11.2 | First Contentful Paint | < 2s | ☐ |
| 11.3 | Largest Contentful Paint | < 3s | ☐ |
| 11.4 | Time to Interactive | < 4s | ☐ |
| 11.5 | Total Blocking Time | < 300ms | ☐ |
| 11.6 | Cumulative Layout Shift | < 0.1 | ☐ |

---

## القسم 12 — Hydration warnings

افتح DevTools → Console أثناء التنقل بين الصفحات:

| # | الفحص | متوقَّع | الحالة |
|---|---|---|---|
| 12.1 | لا تحذيرات "Hydration mismatch" | console نظيف | ☐ |
| 12.2 | لا تحذيرات "There was an error..." | ✓ | ☐ |
| 12.3 | لا أخطاء في useEffect | ✓ | ☐ |

---

## القسم 13 — Mobile testing

اختبر على هاتف فعلي (iPhone أو Android):

| # | الفحص | متوقَّع | الحالة |
|---|---|---|---|
| 13.1 | فتح الموقع في Safari/Chrome | يعمل | ☐ |
| 13.2 | تسجيل الدخول | يعمل | ☐ |
| 13.3 | Add to Home Screen | يعمل | ☐ |
| 13.4 | فتح من الـ home (standalone) | بدون شريط متصفح | ☐ |
| 13.5 | `/my-jobs` (الفنّي) | يعمل + GPS prompt | ☐ |
| 13.6 | التوقيع الإلكتروني | يعمل بإصبع | ☐ |
| 13.7 | الكاميرا (لو مستخدمة) | تطلب إذن | ☐ |

---

## القائمة المختصرة قبل الإطلاق الرسمي

عندما يكون كل ما سبق ✅:

- [ ] جلسة UAT كاملة مع `UAT_CHECKLIST.md` (60+ سيناريو)
- [ ] استيراد بيانات حقيقية من Excel files
- [ ] إنشاء حسابات الموظفين الفعليين
- [ ] تدريب 30 دقيقة لكل فريق (مكتب، فنّيين، محاسبة)
- [ ] فحص النسخ الاحتياطي اليومي يعمل
- [ ] **توقيع المدير العام بالاعتماد**

---

## الإبلاغ عن مشاكل

ملف ISSUES_FOUND.md (ينشأ من قبلك أثناء الاختبار):

```markdown
## مشكلة #1
**التاريخ**: ____________
**الصفحة/المسار**: ____________
**الخطوات**: 1. … 2. …
**النتيجة المتوقَّعة**:
**النتيجة الفعلية**:
**الـ console error** (لو ظهر):
**الـ network response** (status code):
```

أرسل هذا الملف لـ Claude لإصلاح كل مشكلة.

---

**جاهزية الإنتاج = كل البنود ✅ بدون استثناء.**
