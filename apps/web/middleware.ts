import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { env } from '@/lib/env';

/**
 * Middleware يجمع:
 *   1. تجديد جلسة Supabase (updateSession)
 *   2. Security headers على كل response
 *
 * ترتيب: نشغّل auth أولاً (قد يُعيد توجيه)، ثم نضيف headers.
 */

const isProd = process.env.NODE_ENV === 'production';

function buildCsp(supabaseUrl: string): string {
  const supabaseHost = new URL(supabaseUrl).host;
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': isProd
      ? ["'self'", "'unsafe-inline'"]  // unsafe-inline لـ Next.js inline scripts
      : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    'style-src': ["'self'", "'unsafe-inline'"],  // Tailwind يحقن styles
    'img-src': ["'self'", 'data:', 'blob:', `https://${supabaseHost}`, 'https://*.supabase.co'],
    'font-src': ["'self'", 'data:'],
    'connect-src': [
      "'self'",
      `https://${supabaseHost}`,
      `wss://${supabaseHost}`,  // Realtime
      'https://*.supabase.co',
      'wss://*.supabase.co',
      ...(isProd ? [] : ['ws:', 'wss:']),
    ],
    'frame-ancestors': ["'none'"],  // منع clickjacking
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  };
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(' ')}`)
    .join('; ');
}

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  const csp = buildCsp(env.NEXT_PUBLIC_SUPABASE_URL);
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(self), geolocation=(self), interest-cohort=()'
  );
  if (isProd) {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  return response;
}

export const config = {
  matcher: [
    // نطبّق على كل المسارات ما عدا:
    //   - أصول _next الثابتة
    //   - الصور والأيقونات
    //   - sw.js و manifest.json (يحتاجان headers خاصة)
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
