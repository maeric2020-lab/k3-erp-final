/**
 * معالج أخطاء موحَّد لكل مسارات الـ API.
 *
 * يحلّ ثلاث مشاكل دفعة واحدة:
 *   1. ثلث الـ API كان بدون try/catch (يكشف stack traces)
 *   2. كل مسار يكتب صياغة JSON الخطأ بطريقته الخاصة
 *   3. الأخطاء لا تُسجَّل بشكل مركزي
 *
 * استخدامه:
 *   import { withErrorHandler, ApiError } from '@/lib/api/error-handler';
 *
 *   export const POST = withErrorHandler(async (req) => {
 *     const body = await req.json();
 *     if (!body.x) throw new ApiError(400, 'invalid_input', 'x مطلوب');
 *     // ... منطق
 *     return Response.json({ ok: true });
 *   });
 */

import { ZodError } from 'zod';
import { logger } from '@/lib/logger';
import { isProduction } from '@/lib/env';

/**
 * خطأ API مهيكَل. ارمِه بدلاً من throw new Error في API routes.
 * code يُسجَّل في logs ويُرسَل للعميل (لا يحوي معلومات حسّاسة).
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly userMessage: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(userMessage);
    this.name = 'ApiError';
  }
}

/** أخطاء قياسية شائعة الاستخدام */
export const ApiErrors = {
  unauthorized: (msg = 'غير مصرَّح بالدخول') => new ApiError(401, 'unauthorized', msg),
  forbidden: (msg = 'لا تملك الصلاحية لهذا الإجراء') => new ApiError(403, 'forbidden', msg),
  notFound: (msg = 'العنصر غير موجود') => new ApiError(404, 'not_found', msg),
  conflict: (msg = 'تعارض في البيانات') => new ApiError(409, 'conflict', msg),
  badRequest: (msg = 'بيانات غير صحيحة', details?: Record<string, unknown>) =>
    new ApiError(400, 'bad_request', msg, details),
  unprocessable: (msg = 'البيانات لا تتوافق مع الشروط') => new ApiError(422, 'unprocessable', msg),
  rateLimit: (msg = 'تم تجاوز الحد المسموح') => new ApiError(429, 'rate_limit', msg),
  serverError: (msg = 'خطأ غير متوقع في الخادم') => new ApiError(500, 'server_error', msg),
};

type Handler = (req: Request, context: { params?: Record<string, string> }) => Promise<Response> | Response;

/**
 * يُغلّف API handler بـ try/catch موحَّد.
 *
 * - ApiError → JSON منظَّم بـ status المناسب
 * - ZodError → 400 مع تفاصيل الحقول الفاشلة
 * - أي خطأ آخر → 500 + log كامل (بدون كشف stack للعميل في production)
 */
export function withErrorHandler(handler: Handler): Handler {
  return async (req, context) => {
    const start = Date.now();
    const method = req.method;
    const url = new URL(req.url);
    const path = url.pathname;

    try {
      const response = await handler(req, context);
      // تسجيل ناجح خفيف للأداء
      logger.debug('api.ok', {
        method,
        path,
        status: response.status,
        ms: Date.now() - start,
      });
      return response;
    } catch (err) {
      const ms = Date.now() - start;

      // 1) ApiError — معروف ومتوقَّع
      if (err instanceof ApiError) {
        logger.warn('api.error', {
          method, path, status: err.status, code: err.code, ms,
          details: err.details,
        });
        return Response.json(
          {
            error: err.code,
            message: err.userMessage,
            ...(err.details ? { details: err.details } : {}),
          },
          { status: err.status }
        );
      }

      // 2) ZodError — فشل تحقق الـ schema
      if (err instanceof ZodError) {
        logger.warn('api.validation_failed', {
          method, path, ms,
          issues: err.errors,
        });
        return Response.json(
          {
            error: 'validation_failed',
            message: 'البيانات المرسلة غير صحيحة',
            details: err.errors.map((e) => ({
              path: e.path.join('.'),
              message: e.message,
            })),
          },
          { status: 400 }
        );
      }

      // 3) خطأ غير متوقَّع — log كامل، رد عام
      const errorObj = err instanceof Error ? err : new Error(String(err));
      logger.error('api.unhandled', errorObj, { method, path, ms });

      return Response.json(
        {
          error: 'server_error',
          message: 'خطأ غير متوقع في الخادم. يُرجى المحاولة لاحقاً.',
          // في dev نكشف الرسالة لتسهيل التصحيح
          ...(isProduction ? {} : { debug: errorObj.message }),
        },
        { status: 500 }
      );
    }
  };
}
