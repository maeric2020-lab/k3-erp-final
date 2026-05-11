/**
 * Rate limiter بسيط (sliding window).
 *
 * الإصدار الحالي: in-memory. مناسب لـ Vercel deployment واحد.
 * عند توسيع إلى نسخ متعددة، يجب استخدام Upstash Redis (env متوفّر).
 *
 * الواجهة `RateLimiter` متطابقة مع Upstash @upstash/ratelimit، فاستبداله
 * في المستقبل = تغيير سطر واحد في `getLimiter()`.
 */

import { logger } from '@/lib/logger';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;  // ms until window resets
}

export interface RateLimiter {
  limit(key: string): Promise<RateLimitResult>;
}

// -----------------------------------------------------------------------------
// In-memory implementation (sliding window)
// -----------------------------------------------------------------------------

interface Bucket {
  count: number;
  resetAt: number;
}

class MemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, Bucket>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {
    // تنظيف دوري للمفاتيح المنتهية كي لا تنفجر الذاكرة
    if (typeof setInterval !== 'undefined') {
      this.cleanupTimer = setInterval(() => this.cleanup(), Math.max(windowMs, 60_000));
      // لا نمنع Node.js من الخروج بسبب الـ timer
      if (typeof this.cleanupTimer.unref === 'function') this.cleanupTimer.unref();
    }
  }

  async limit(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt < now) {
      // window جديد
      const next = { count: 1, resetAt: now + this.windowMs };
      this.buckets.set(key, next);
      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        resetMs: this.windowMs,
      };
    }

    if (bucket.count >= this.maxRequests) {
      return {
        success: false,
        limit: this.maxRequests,
        remaining: 0,
        resetMs: bucket.resetAt - now,
      };
    }

    bucket.count++;
    return {
      success: true,
      limit: this.maxRequests,
      remaining: this.maxRequests - bucket.count,
      resetMs: bucket.resetAt - now,
    };
  }

  private cleanup() {
    const now = Date.now();
    let removed = 0;
    for (const [k, v] of this.buckets) {
      if (v.resetAt < now) {
        this.buckets.delete(k);
        removed++;
      }
    }
    if (removed > 0) logger.debug('ratelimit.cleanup', { removed });
  }
}

// -----------------------------------------------------------------------------
// مصنع: حدّ مختلف لكل غرض
// -----------------------------------------------------------------------------

const limiters = new Map<string, RateLimiter>();

/**
 * يُعيد limiter بإعدادات محدَّدة. الـ instance يُحفَظ في الذاكرة بين الطلبات.
 *
 * أمثلة:
 *   getLimiter('api', 100, 60_000)        → 100 طلب/دقيقة لكل مفتاح
 *   getLimiter('upload', 10, 60_000)      → 10 رفعات/دقيقة
 *   getLimiter('login', 5, 60_000)        → 5 محاولات/دقيقة (anti brute-force)
 *   getLimiter('payment', 3, 10_000)      → دفعتان/10 ثوانٍ (anti double-click)
 */
export function getLimiter(name: string, maxRequests: number, windowMs: number): RateLimiter {
  const key = `${name}:${maxRequests}:${windowMs}`;
  let lim = limiters.get(key);
  if (!lim) {
    lim = new MemoryRateLimiter(maxRequests, windowMs);
    limiters.set(key, lim);
  }
  return lim;
}

// -----------------------------------------------------------------------------
// مساعد: استخراج مفتاح من الطلب
// -----------------------------------------------------------------------------

/**
 * يستخرج مفتاحاً مناسباً للـ rate limiting من Request.
 * يُفضّل user_id إن وُجد (محسّن في API routes بعد المصادقة)،
 * وإلا يستخدم IP من x-forwarded-for أو fallback.
 */
export function rateLimitKey(req: Request, opts: { userId?: string; suffix?: string } = {}): string {
  const id = opts.userId ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous';
  return opts.suffix ? `${id}:${opts.suffix}` : id;
}

/**
 * يطبّق rate limiter على الطلب ويُعيد Response جاهز إذا تجاوز الحد.
 * استخدامه في API routes:
 *
 *   export async function POST(req: Request) {
 *     const blocked = await checkRateLimit('upload', 10, 60_000, req);
 *     if (blocked) return blocked;
 *     // ... باقي المنطق
 *   }
 */
export async function checkRateLimit(
  name: string,
  maxRequests: number,
  windowMs: number,
  req: Request,
  opts: { userId?: string } = {}
): Promise<Response | null> {
  const limiter = getLimiter(name, maxRequests, windowMs);
  const key = rateLimitKey(req, { userId: opts.userId, suffix: name });
  const result = await limiter.limit(key);

  if (!result.success) {
    logger.warn('ratelimit.exceeded', { name, key, limit: result.limit, resetMs: result.resetMs });
    return new Response(
      JSON.stringify({
        error: 'تم تجاوز الحد المسموح. حاول بعد قليل.',
        retry_after_ms: result.resetMs,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil((Date.now() + result.resetMs) / 1000)),
          'Retry-After': String(Math.ceil(result.resetMs / 1000)),
        },
      }
    );
  }

  return null;
}
