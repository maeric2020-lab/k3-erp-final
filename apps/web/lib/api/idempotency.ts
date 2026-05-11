/**
 * Idempotency للعمليات المالية الحسّاسة.
 *
 * المشكلة: المستخدم يضغط "تسجيل دفعة" مرتين بسبب lag → دفعتان مسجَّلتان.
 * الحل: العميل يُرسل header `Idempotency-Key` (UUID مثلاً).
 *       إذا وصل نفس المفتاح خلال نافذة زمنية، نُعيد نفس النتيجة بدون
 *       تنفيذ المنطق مرتين.
 *
 * الإصدار الحالي: in-memory. عند توسيع لـ Redis، استبدل MemoryStore.
 *
 * استخدامه:
 *   const cached = await checkIdempotency(req, userId);
 *   if (cached) return cached;
 *   // ... منطق المعاملة
 *   const result = Response.json({ ok: true });
 *   await storeIdempotency(req, userId, result);
 *   return result;
 */

import { logger } from '@/lib/logger';

interface CachedResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
  storedAt: number;
}

interface IdempotencyStore {
  get(key: string): Promise<CachedResponse | null>;
  set(key: string, value: CachedResponse): Promise<void>;
}

class MemoryIdempotencyStore implements IdempotencyStore {
  private cache = new Map<string, CachedResponse>();
  private ttlMs: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(ttlMs: number = 24 * 60 * 60 * 1000) {  // 24 ساعة افتراضياً
    this.ttlMs = ttlMs;
    if (typeof setInterval !== 'undefined') {
      this.cleanupTimer = setInterval(() => this.cleanup(), 60 * 60 * 1000);  // كل ساعة
      if (typeof this.cleanupTimer.unref === 'function') this.cleanupTimer.unref();
    }
  }

  async get(key: string): Promise<CachedResponse | null> {
    const v = this.cache.get(key);
    if (!v) return null;
    if (Date.now() - v.storedAt > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return v;
  }

  async set(key: string, value: CachedResponse): Promise<void> {
    this.cache.set(key, value);
  }

  private cleanup() {
    const now = Date.now();
    let removed = 0;
    for (const [k, v] of this.cache) {
      if (now - v.storedAt > this.ttlMs) {
        this.cache.delete(k);
        removed++;
      }
    }
    if (removed > 0) logger.debug('idempotency.cleanup', { removed });
  }
}

const store: IdempotencyStore = new MemoryIdempotencyStore();

/**
 * يُولّد مفتاح cache من (Idempotency-Key + userId + path).
 * - Idempotency-Key يأتي من العميل
 * - userId يمنع تصادم بين المستخدمين
 * - path يمنع نفس المفتاح من إعادة استخدامه على endpoint مختلف
 */
function buildCacheKey(idempotencyKey: string, userId: string, path: string): string {
  return `${userId}:${path}:${idempotencyKey}`;
}

/**
 * يفحص إذا كان هذا الطلب قد نُفِّذ سابقاً بنفس Idempotency-Key.
 * إذا نعم: يُعيد Response المخزَّنة.
 * إذا لا: يُعيد null (المعالج يكمل عمله).
 *
 * ملاحظة: إذا لم يُرسل العميل Idempotency-Key، الدالة تُعيد null
 * (idempotency اختياري — لكن لا يُنصَح به للعمليات المالية).
 */
export async function checkIdempotency(
  req: Request,
  userId: string
): Promise<Response | null> {
  const key = req.headers.get('Idempotency-Key');
  if (!key) return null;

  // تحقق بسيط من شكل المفتاح (UUID-like، 8-128 char)
  if (key.length < 8 || key.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(key)) {
    logger.warn('idempotency.invalid_key', { key: key.slice(0, 20) });
    return null;
  }

  const path = new URL(req.url).pathname;
  const cacheKey = buildCacheKey(key, userId, path);
  const cached = await store.get(cacheKey);

  if (cached) {
    logger.info('idempotency.hit', { path, userId, key: key.slice(0, 8) });
    return new Response(cached.body, {
      status: cached.status,
      headers: { ...cached.headers, 'Idempotent-Replay': 'true' },
    });
  }

  return null;
}

/**
 * يُخزّن Response لاستعادتها لاحقاً.
 * لا يُخزّن إن لم يكن هناك Idempotency-Key، أو إن كان status >= 500
 * (لأننا نريد للعميل إعادة المحاولة في حال فشل الخادم).
 */
export async function storeIdempotency(
  req: Request,
  userId: string,
  response: Response
): Promise<Response> {
  const key = req.headers.get('Idempotency-Key');
  if (!key) return response;
  if (response.status >= 500) return response;

  // نَستنسخ الـ Response لقراءة الـ body دون استهلاكها
  const cloned = response.clone();
  const body = await cloned.text();
  const headers: Record<string, string> = {};
  cloned.headers.forEach((v, k) => { headers[k] = v; });

  const path = new URL(req.url).pathname;
  const cacheKey = buildCacheKey(key, userId, path);

  await store.set(cacheKey, {
    status: response.status,
    body,
    headers,
    storedAt: Date.now(),
  });

  logger.debug('idempotency.stored', { path, userId, key: key.slice(0, 8) });
  return response;
}
