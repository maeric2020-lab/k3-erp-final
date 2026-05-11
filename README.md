# K3 ERP

> نظام إدارة قسم الصيانة لشركة كي ثري للتجارة العامة والمقاولات

نظام كامل لإدارة:
- العملاء والآلات
- العقود (CASH / CO / CW / CWC / UG)
- طلبات الصيانة وتدفقها
- الفنّيين والوظائف الميدانية
- الفواتير والدفعات
- التقارير الاحترافية
- المحادثات الداخلية
- الإشعارات الفورية

## التقنية

- **Next.js 14** + TypeScript
- **Supabase** (Postgres + Auth + Storage + Realtime)
- **Tailwind CSS** + RTL/LTR
- **PWA** للموبايل (يعمل offline)

## البدء السريع

اتبع `DEPLOYMENT_GUIDE.md` (دليل خطوة بخطوة بالعربية).

```bash
pnpm install
pnpm verify           # فحص شامل
pnpm dev              # تشغيل محلي
pnpm build            # بناء production
```

## الهيكل

```
k3-erp/
├── apps/web/                # Next.js application
│   ├── app/                 # الصفحات والـ API routes
│   ├── components/          # مكونات React
│   ├── lib/                 # helpers (env, logger, rate-limit, etc.)
│   ├── public/              # sw.js, manifest.json
│   └── messages/            # ترجمات
├── packages/
│   ├── shared-types/        # database.types.ts
│   ├── repositories/        # طبقة Supabase الوحيدة
│   ├── services/            # منطق الأعمال
│   └── validators/          # zod schemas
├── supabase/migrations/     # 33 ترحيل SQL
├── scripts/                 # backup, perf, rls-audit, verify
├── e2e/                     # اختبارات Playwright
└── docs/                    # تقارير وأدلة
```

## القواعد المعمارية

1. **`compute_line_pricing` هو المصدر الوحيد للأسعار**
2. **RLS هو مصدر الحقيقة في الأمن**
3. **المستودعات هي الطبقة الوحيدة التي تلامس Supabase**
4. **كل عمود نصّي له `_ar` و `_en`**
5. **الفنّي لا يختار الحالة** — انتقالات تلقائية
6. **multi-tenant جاهز** — كل البيانات تحوي `company_id`

## الإصدار

- **v1.0** — مايو 2026
- 33 ترحيل DB | 92 API route | 54 صفحة | 19 مستودع | ~370 ملف

---

| للنشر | `DEPLOYMENT_GUIDE.md` |
|---|---|
| للاختبار اليدوي | `UAT_CHECKLIST.md` |
| لتقرير الأمن | `RLS_AUDIT_REPORT.md` |
| للتدقيق المعماري | `ARCHITECTURE_AUDIT_PRE_PHASE_8.md` |
