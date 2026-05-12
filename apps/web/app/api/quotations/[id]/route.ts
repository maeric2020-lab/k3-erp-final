import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { withErrorHandler, ApiErrors } from '@/lib/api/error-handler';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';

/**
 * يُستدعى يومياً الساعة 6 صباحاً (UTC = 9 صباحاً بتوقيت الكويت).
 * يُجدول المهام الدورية في الـ queue:
 *   - فحص الفواتير المتأخرة (إشعارات للمحاسبة)
 *   - فحص العقود التي قاربت على الانتهاء
 */

export const POST = withErrorHandler(async (req: Request) => {
  const cronSecret = env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    throw ApiErrors.unauthorized('CRON_SECRET غير صحيح');
  }

  const supabase = createSupabaseAdminClient();
  const enqueued: Array<{ task: string; id: string }> = [];

  // 1) فحص الفواتير المتأخرة (لكل company)
  const { data: companies } = await supabase
    .from('companies')
    .select('id')
    .eq('is_active', true);

  for (const company of companies ?? []) {
    // نُعيّن company_id يدوياً لأن service_role لا يمر عبر fn_current_company_id
    const { data: id1 } = await supabase
      .from('job_queue')
      .insert({
        company_id: (company as any).id,
        task_type: 'check_overdue_invoices',
        payload: {},
        priority: 50,
      } as any)
      .select('id')
      .single();
    if (id1) enqueued.push({ task: 'check_overdue_invoices', id: (id1 as any).id });

    // 2) فحص العقود
    const { data: id2 } = await supabase
      .from('job_queue')
      .insert({
        company_id: (company as any).id,
        task_type: 'check_expiring_contracts',
        payload: { days_before: 30 },
        priority: 50,
      } as any)
      .select('id')
      .single();
    if (id2) enqueued.push({ task: 'check_expiring_contracts', id: (id2 as any).id });
  }

  logger.info('queue.daily_scheduled', { count: enqueued.length });
  return Response.json({ enqueued });
});

export const GET = POST;  // نفس الفعل (Vercel cron يستخدم GET أحياناً)
