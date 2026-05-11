import { runWorker } from '@/lib/queue/worker';
import { withErrorHandler, ApiErrors } from '@/lib/api/error-handler';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';

/**
 * Endpoint لمعالجة المهام في الـ queue.
 *
 * يُستدعى من Vercel Cron (vercel.json) كل ساعة.
 * أو يدوياً عبر `curl -X POST -H "Authorization: Bearer $CRON_SECRET" /api/queue/process`
 *
 * الحماية: يتطلب Authorization header مع CRON_SECRET (متغير بيئة).
 * إذا غاب CRON_SECRET، يقبل من Vercel cron فقط (للتطوير).
 */

export const POST = withErrorHandler(async (req: Request) => {
  // التحقق من المصدر
  const cronSecret = env.CRON_SECRET;
  const auth = req.headers.get('authorization');

  if (cronSecret) {
    if (auth !== `Bearer ${cronSecret}`) {
      throw ApiErrors.unauthorized('CRON_SECRET غير صحيح');
    }
  } else {
    // dev mode: نسمح فقط من Vercel cron user-agent
    const userAgent = req.headers.get('user-agent') ?? '';
    if (!userAgent.includes('vercel-cron')) {
      logger.warn('queue.unprotected_call', { userAgent });
    }
  }

  const workerId = `worker_${Date.now()}`;
  const result = await runWorker(workerId);

  logger.info('queue.run_completed', {
    workerId,
    ...result,
    errorCount: result.errors.length,
  });

  return Response.json(result);
});

// GET للتحقق من الصحة (health check) — لا يعالج
export const GET = withErrorHandler(async () => {
  return Response.json({
    ok: true,
    worker: 'k3-erp-queue',
    timestamp: new Date().toISOString(),
  });
});
