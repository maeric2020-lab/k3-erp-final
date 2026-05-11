/**
 * تحقق مركزي من متغيرات البيئة (env validation)
 *
 * يُستخدَم في كل مكان بدلاً من `process.env.X` المباشر.
 * فوائده:
 *   1. خطأ واضح عند بدء التطبيق إذا غاب متغير حسّاس (بدلاً من خطأ runtime مبهم)
 *   2. أنواع TypeScript دقيقة لكل متغير
 *   3. فصل صريح بين متغيرات server-only ومتغيرات public
 *
 * قاعدة Next.js: المتغيرات التي تبدأ بـ NEXT_PUBLIC_ تُحقَن في bundle المتصفح،
 * والباقي يبقى على الخادم فقط. يجب فصل التحقق وفقاً لذلك.
 */

import { z } from 'zod';

// -----------------------------------------------------------------------------
// مخطط الـ server (لا يُستورَد من client)
// -----------------------------------------------------------------------------
const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, {
    message: 'SUPABASE_SERVICE_ROLE_KEY مطلوب (مفتاح service_role من إعدادات Supabase)',
  }),
  // اختياريّات
  SENTRY_DSN: z.string().url().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(10).optional(),
  // CRON_SECRET — لحماية مسارات /api/queue/* عند الاستدعاء الخارجي
  CRON_SECRET: z.string().min(16).optional(),
});

// -----------------------------------------------------------------------------
// مخطط الـ client (متاح في bundle المتصفح)
// -----------------------------------------------------------------------------
const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url({
    message: 'NEXT_PUBLIC_SUPABASE_URL مطلوب وبصيغة URL صحيحة',
  }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, {
    message: 'NEXT_PUBLIC_SUPABASE_ANON_KEY مطلوب (المفتاح العام من Supabase)',
  }),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

// -----------------------------------------------------------------------------
// التحقق الفعلي + رسائل خطأ واضحة
// -----------------------------------------------------------------------------

function parseEnv<T extends z.ZodObject<any>>(schema: T, source: Record<string, string | undefined>, label: string): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const errors = result.error.errors.map((e) => `  • ${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(
      `\n❌ خطأ في متغيرات البيئة (${label}):\n${errors}\n\n` +
      `أنشئ ملف .env.local في جذر المشروع وأضف المتغيرات الناقصة.\n` +
      `راجع .env.example للنموذج الكامل.`
    );
  }
  return result.data;
}

// عند الـ build وقت التشغيل، Next.js يُمرّر متغيرات البيئة عبر process.env
// نُمرّر فقط ما تحتاجه كل بيئة: client يأخذ NEXT_PUBLIC_*، server يأخذ كل شيء.

const isServer = typeof window === 'undefined';

const _clientEnv = parseEnv(clientSchema, {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
}, 'client');

// server-only: نُحقّق فقط على الخادم لتفادي تضمين القيم في bundle المتصفح
const _serverEnv: z.infer<typeof serverSchema> | null = isServer
  ? parseEnv(serverSchema, {
      NODE_ENV: process.env.NODE_ENV,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      SENTRY_DSN: process.env.SENTRY_DSN,
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
      CRON_SECRET: process.env.CRON_SECRET,
    }, 'server')
  : null;

// -----------------------------------------------------------------------------
// واجهة موحَّدة
// -----------------------------------------------------------------------------

/**
 * متغيرات البيئة المتاحة في المتصفح + الخادم.
 */
export const env = {
  // client (متاحة في كل مكان)
  NEXT_PUBLIC_SUPABASE_URL: _clientEnv.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: _clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: _clientEnv.NEXT_PUBLIC_APP_URL,

  // server-only (تُرمى إن استُخدِمت في client)
  get NODE_ENV() {
    if (!_serverEnv) throw new Error('NODE_ENV لا يُقرأ من client');
    return _serverEnv.NODE_ENV;
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    if (!_serverEnv) throw new Error('SUPABASE_SERVICE_ROLE_KEY لا يُقرأ من client — يجب أن يبقى على الخادم');
    return _serverEnv.SUPABASE_SERVICE_ROLE_KEY;
  },
  get SENTRY_DSN() {
    if (!_serverEnv) return undefined;
    return _serverEnv.SENTRY_DSN;
  },
  get UPSTASH_REDIS_REST_URL() {
    if (!_serverEnv) return undefined;
    return _serverEnv.UPSTASH_REDIS_REST_URL;
  },
  get UPSTASH_REDIS_REST_TOKEN() {
    if (!_serverEnv) return undefined;
    return _serverEnv.UPSTASH_REDIS_REST_TOKEN;
  },
  get CRON_SECRET() {
    if (!_serverEnv) return undefined;
    return _serverEnv.CRON_SECRET;
  },
} as const;

/** فحص بيئة الإنتاج (يُستخدَم في security headers و logging) */
export const isProduction = isServer && _serverEnv?.NODE_ENV === 'production';
export const isDevelopment = isServer && _serverEnv?.NODE_ENV === 'development';
