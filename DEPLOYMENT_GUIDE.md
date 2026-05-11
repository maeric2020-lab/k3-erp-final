# دليل النشر — K3 ERP

> هذا الدليل يأخذك خطوة بخطوة من ملفات المشروع إلى نظام يعمل على الإنترنت.
> الوقت المتوقَّع: ساعة إلى ساعتين أوّل مرة.

---

## ما تحتاجه قبل البدء

- حساب على [GitHub](https://github.com) (مجاني)
- حساب على [Supabase](https://supabase.com) (مجاني)
- حساب على [Vercel](https://vercel.com) (مجاني — يكفي Hobby plan)
- Node.js 20+ مثبَّت محلياً (للترجمة الأوّلية فقط)
- pnpm (`npm install -g pnpm`)

---

## الخطوة 1 — تجهيز المشروع محلياً

### 1.1 فك الضغط

```bash
tar xzf k3-erp-final.tar.gz
cd k3-erp
```

### 1.2 تثبيت dependencies

```bash
pnpm install
```

سيستغرق 2-3 دقائق أوّل مرة.

### 1.3 فحص أن كل شيء سليم

```bash
pnpm verify
```

ستظهر:
```
✅ packages/repositories/src/index.ts
✅ packages/services/src/index.ts
✅ packages/validators/src/index.ts
✅ packages/shared-types/src/index.ts
✅ لا توجد تصديرات مكررة. الـ build نظيف.

✅ كل الاستيرادات صحيحة. 289 ملف.
```

إذا فشل، توقّف هنا واتصل بنا — لا تكمل.

---

## الخطوة 2 — Supabase

### 2.1 إنشاء مشروع جديد

1. اذهب إلى https://app.supabase.com
2. اضغط **New Project**
3. اختر:
   - **Name**: `k3-erp` (أو ما تشاء)
   - **Database Password**: ⚠️ **احفظها فوراً** — لا يمكن استرجاعها لاحقاً
   - **Region**: اختر أقرب منطقة (Frankfurt للكويت)
   - **Pricing Plan**: Free يكفي للبداية
4. انتظر 2 دقيقة حتى يجهز المشروع

### 2.2 جلب المفاتيح

من المشروع الجديد، اذهب إلى **Project Settings → API** واحفظ:

```
Project URL:       https://xxxxxxxxxxx.supabase.co
anon (public):     eyJhbGc...      (مفتاح عام، يظهر للمتصفح)
service_role:      eyJhbGc...      (سرّي! خادم فقط)
```

⚠️ **لا تكشف service_role key أبداً في الكود أو git**.

### 2.3 تطبيق الترحيلات

سترسل الترحيلات الـ 33 إلى قاعدة البيانات.

#### الطريقة الموصى بها — عبر Supabase CLI

```bash
# تثبيت CLI (إن لم يكن مثبتاً)
npm install -g supabase

# ربط المشروع المحلي بالمشروع على Supabase
supabase link --project-ref YOUR-PROJECT-REF

# تطبيق الترحيلات
supabase db push
```

سيظهر:
```
Applying migration 20260101000000_001_extensions.sql...
Applying migration 20260101000001_002_company_settings.sql...
... (33 ترحيل)
✅ Database is up to date
```

#### الطريقة البديلة — يدوياً عبر SQL Editor

إذا لم تستخدم CLI:
1. افتح **SQL Editor** في Supabase
2. لكل ملف في `supabase/migrations/` (مرتَّبة حسب الاسم):
   - افتح الملف
   - انسخ محتواه
   - الصقه في SQL Editor
   - اضغط **Run**
3. تأكّد من نجاح كل ترحيل قبل المتابعة للتالي

### 2.4 فحص الترحيل

في **SQL Editor**، شغّل:

```sql
SELECT count(*) AS tables FROM pg_tables WHERE schemaname = 'public';
SELECT count(*) AS functions FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public';
SELECT count(*) AS migrations FROM supabase_migrations.schema_migrations;
```

النتائج المتوقّعة:
- tables: ~42
- functions: ~30
- migrations: 33

### 2.5 إنشاء buckets للتخزين

في **Storage**، أنشئ ثلاثة buckets (Private — ليس Public):

1. **signatures** (5 MB حد لكل ملف)
2. **contract-attachments** (25 MB)
3. **chat-attachments** (25 MB)
4. **backups** (لا حد محدد، خاص جداً)

الترحيلات تُضيف RLS policies تلقائياً.

---

## الخطوة 3 — GitHub

### 3.1 إنشاء repository جديد

1. https://github.com/new
2. الاسم: `k3-erp` (أو ما تختاره)
3. ⚠️ **Private** — لا تُجعله عاماً
4. لا تختر README/gitignore (سننشئ بأنفسنا)

### 3.2 رفع المشروع

```bash
cd k3-erp

# إنشاء .gitignore
cat > .gitignore <<EOF
node_modules/
.next/
dist/
.env.local
.env
*.tsbuildinfo
.DS_Store
.vercel
.turbo
EOF

git init
git add .
git commit -m "Initial commit — K3 ERP v1.0"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/k3-erp.git
git push -u origin main
```

---

## الخطوة 4 — Vercel

### 4.1 ربط Vercel بـ GitHub

1. اذهب إلى https://vercel.com/new
2. **Import Git Repository** → اختر `k3-erp`
3. **Framework Preset**: Next.js (يُكتشف تلقائياً)
4. **Root Directory**: اضغط **Edit** → اختر `apps/web`

### 4.2 متغيرات البيئة

في **Environment Variables**، أضف:

| Name | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | https://xxxxx.supabase.co | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | eyJhbGc... (anon key) | All |
| `SUPABASE_SERVICE_ROLE_KEY` | eyJhbGc... (service_role) | All |
| `NEXT_PUBLIC_APP_URL` | https://your-app.vercel.app | Production |
| `CRON_SECRET` | (string عشوائي قوي 32+ حرف) | All |

⚠️ بعد أوّل deploy، عُد وعدّل `NEXT_PUBLIC_APP_URL` ليطابق الرابط الفعلي الذي خصّصه Vercel.

لتوليد `CRON_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4.3 Deploy

اضغط **Deploy**. سيستغرق 2-4 دقائق.

أثناء البناء قد ترى تحذيرات حول `lucide-react` أو حجم bundle — تجاهلها.

### 4.4 افتح التطبيق

عند انتهاء الـ deploy، اضغط **Visit**.

ستفتح صفحة `/setup` لإنشاء أوّل مدير.

---

## الخطوة 5 — أوّل مدير

في صفحة `/setup`:
1. اكتب بريدك الإلكتروني
2. اسمك الكامل (عربي + إنجليزي)
3. اضغط **إنشاء**

ستتحول إلى `/login`. تحقق من بريدك → ستجد إيميل من Supabase بكلمة مرور مؤقتة.

سجّل الدخول، ستفتح **لوحة التحكم**.

---

## الخطوة 6 — ضبط Vercel Cron (اختياري لكن موصى به)

الـ cron jobs تُشغّل المهام الدورية (فحص الفواتير المتأخرة، العقود المنتهية).

### 6.1 تأكيد ملف vercel.json

تأكّد أن `apps/web/vercel.json` موجود مع:
```json
{
  "crons": [
    { "path": "/api/queue/process", "schedule": "*/1 * * * *" },
    { "path": "/api/queue/scheduled/daily", "schedule": "0 6 * * *" }
  ]
}
```

### 6.2 تفعيل الـ Cron

Vercel يفعّلها تلقائياً عند الـ deploy إذا كان الحساب على **Pro Plan** (20$/شهر).
في **Hobby Plan** الـ cron محدود — ستحتاج خدمة خارجية مثل [cron-job.org](https://cron-job.org) تستدعي الـ endpoint.

---

## الخطوة 7 — استيراد بياناتك الأوّلية

### 7.1 رفع ملف الخدمات

من **القائمة الجانبية → الإدارة → استيراد**:

1. اختر "خدمات الصيانة وأسعارها"
2. ارفع `قائمة_انواع_خدمات_الصيانة_واسعارها.xlsx`
3. ستظهر معاينة 414 صف
4. اضغط **استيراد**

### 7.2 رفع ملف العقود

نفس الخطوات لـ `قائمة_تسعيير_العقود.xlsx` (444 صف).

### 7.3 إضافة العملاء

من **العمليات → العملاء → إضافة عميل**:
- يمكنك الإضافة يدوياً
- أو رفع ملف Excel بقائمة العملاء (إذا توفّر)

---

## الخطوة 8 — إنشاء حسابات الموظفين

### 8.1 قوالب الصلاحيات

من **الإدارة → قوالب الصلاحيات**، أنشئ قوالب مسبقة:
- **فنّي**: `jobs_my:view`, `dashboard:view`, `chat:view`
- **موظف مكتب**: عمليات + مالية كاملة
- **محاسب**: مالية + تقارير
- **مدير عمليات**: كل العمليات

### 8.2 دعوة موظفين

من **الإدارة → المستخدمون → دعوة جديد**:
1. اكتب البريد + الاسم
2. اختر القالب المناسب
3. اضغط **إرسال دعوة**

سيستلم الموظف إيميلاً لتفعيل حسابه.

---

## الخطوة 9 — ضبط النسخ الاحتياطي

### 9.1 على Supabase

Free tier يعمل نسخ احتياطية يومية تلقائياً (يحتفظ بها 7 أيام). ادفع $25/شهر للحصول على 14 يوم + Point-in-Time Recovery.

### 9.2 نسخة محلية

سكربت `scripts/backup/daily-backup.sh` يأخذ نسخة كاملة. يمكن تشغيله من:
- خادم Linux في مكتبك
- GitHub Actions (cron)
- Vercel cron (لكن يتطلب Pro)

---

## الخطوة 10 — تطبيق الموبايل (اختياري)

النظام **PWA** كامل، يعني الموظفون في الميدان يستطيعون "تثبيته" كتطبيق:

### iOS (Safari)
1. افتح الموقع على iPhone
2. اضغط زر المشاركة → **Add to Home Screen**

### Android (Chrome)
1. افتح الموقع
2. ستظهر شارة **Install** تلقائياً، أو من القائمة → **Install app**

التطبيق يعمل **حتى بدون إنترنت**:
- الفنّي يرى وظائفه (المخزَّنة)
- يستطيع تغيير الحالة + التوقيع
- كل التغييرات تُزامن تلقائياً عند عودة الإنترنت

---

## استكشاف الأخطاء

### مشاكل أثناء `pnpm install`

**`ERR_PNPM_PEER_DEP_ISSUES`**: تجاهلها، النظام يعمل رغمها.

**خطأ في `xlsx`**: المشروع يستخدم رابط CDN لـ xlsx لتجنب مشاكل npm registry. تأكّد أن الجهاز يصل إلى https://cdn.sheetjs.com.

### مشاكل أثناء `pnpm build`

**`Type error: Cannot find module '@/lib/...'`**:
- نفّذ `pnpm install` من جذر المشروع (وليس من `apps/web`)
- إذا استمر، احذف `apps/web/.next` وأعد المحاولة

**`Module not found: Can't resolve 'next-intl/server'`**:
- تأكّد أن `next-intl` موجود في dependencies (`pnpm install`)

**`TypeScript error in supabase rpc call`**:
- أعد توليد الأنواع: `pnpm db:gen-types` (يحتاج Supabase CLI مرتبطاً بمشروعك)

### مشاكل بعد الـ deploy

**صفحة 500 على `/dashboard`**:
- افحص Vercel logs (Project → Deployments → اضغط آخر deploy → Functions)
- السبب الأشهر: متغيّر بيئة ناقص. تأكّد أن `SUPABASE_SERVICE_ROLE_KEY` مضبوط.

**"NEXT_PUBLIC_SUPABASE_URL مطلوب وبصيغة URL صحيحة"**:
- المتغيّر إما غير موجود، أو يحوي مسافة في النهاية
- عدّله في Vercel → Settings → Environment Variables → Redeploy

**`/setup` يعرض "Database not initialized"**:
- لم تُطبَّق الترحيلات على Supabase
- ارجع للخطوة 2.3 وطبّق الترحيلات

**`Realtime subscription` لا يعمل (الإشعارات لا تظهر فوراً)**:
- تأكّد أن ترحيل 034 طُبِّق (يُفعّل publication على notifications/chat_messages/chat_threads)
- في Supabase Dashboard → Database → Replication، تحقّق أن الجداول الثلاثة في publication `supabase_realtime`

**مرفقات الـ chat لا تُرفع**:
- تأكّد أن bucket `chat-attachments` موجود وهو **Private** (ليس Public)
- تأكّد أن الترحيل 027 طُبِّق (يُنشئ RLS policies على bucket)

**Service Worker لا يُسجَّل**:
- يعمل فقط في production و على HTTPS (Vercel يوفّره)
- لا يعمل في `pnpm dev` محلياً (هذا متوقَّع)
- في DevTools → Application → Service Workers تحقّق أن `sw.js` نشط

**PWA "Add to Home Screen" لا يظهر**:
- يحتاج HTTPS + Service Worker مُسجَّل + manifest.json صالح
- اختبر على https://www.pwabuilder.com بإدخال رابط موقعك

### مشاكل cron jobs

**على Vercel Hobby plan**:
- Vercel Hobby يدعم cron يومي فقط (مرة واحدة في اليوم)
- الترحيل اليومي `/api/queue/scheduled/daily` سيعمل
- لكن `/api/queue/process` (المعالج كل ساعة) لن يعمل
- **الحل**: استخدم خدمة مجانية:
  1. سجّل في https://cron-job.org
  2. أضف cron جديد: `https://your-app.vercel.app/api/queue/process`
  3. Header: `Authorization: Bearer YOUR_CRON_SECRET`
  4. Schedule: every 1 minute

### "Database is empty / cannot connect"
تأكّد أن `NEXT_PUBLIC_SUPABASE_URL` صحيح + الترحيلات طُبّقت.

### "RLS policy violation"
بعض البيانات لا تظهر؟ المستخدم قد لا يملك الإذن المناسب. اذهب لـ **الإدارة → المستخدمون** وامنحه الشاشات اللازمة.

### "Invalid JWT"
امسح cookies المتصفح وسجّل الدخول من جديد.

### الـ cron لا يعمل
- تأكّد أن `CRON_SECRET` مضبوط في Vercel
- على Hobby plan: استخدم خدمة خارجية تستدعي `/api/queue/process` كل دقيقة

### بطء التحميل
- شغّل `pnpm verify:quick` محلياً للتأكد من سلامة الكود
- في Supabase Dashboard → Database → Indexes تأكّد من تطبيق ترحيل 030 (18 فهرس)

---

## ما التالي؟

### تخصيص النظام
- شعار الشركة: **الإدارة → الإعدادات → الشعار**
- أسماء وعناوين البلد: نفس المكان
- ترقيمات المستندات: **الإدارة → ترقيمات المستندات**

### المراقبة
- Vercel Dashboard يُظهر logs لكل request
- Supabase Dashboard → Logs لرؤية استعلامات DB
- لمراقبة الأخطاء، اشترك بـ [Sentry](https://sentry.io) واضبط `SENTRY_DSN`

### الاستيراد المتكرر
كل ملف Excel جديد لخدمات/أسعار → **الإدارة → استيراد**.

---

## دعم

- مشاكل تقنية: راجع [GitHub Issues](https://github.com/YOUR-USERNAME/k3-erp/issues)
- استشارة معمارية: راجع `ARCHITECTURE_AUDIT_PRE_PHASE_8.md` و `RLS_AUDIT_REPORT.md`
- اختبار يدوي: استخدم `UAT_CHECKLIST.md` (60+ سيناريو بالعربية)

النظام جاهز. **بالتوفيق!** 🚀
