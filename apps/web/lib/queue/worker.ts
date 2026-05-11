/**
 * Queue worker — يستهلك مهام من جدول job_queue.
 *
 * كل task_type له handler. الـ worker:
 *   1. يحجز مهمة (fn_dequeue) — بـ SKIP LOCKED لتجنب التزاحم
 *   2. ينفّذها عبر الـ handler المناسب
 *   3. يُؤكّد إكمالها (fn_complete_job) أو يُسجّل فشلها (fn_fail_job)
 *
 * يُستدعى من /api/queue/process (Vercel cron كل دقيقة).
 * بإمكانه معالجة عدة مهام في استدعاء واحد (حتى MAX_PER_RUN).
 */

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { JobsService } from '@k3/services';

// -----------------------------------------------------------------------------
// تعريف الـ handlers
// -----------------------------------------------------------------------------

type TaskHandler = (payload: Record<string, any>) => Promise<Record<string, any> | void>;

const handlers: Record<string, TaskHandler> = {
  /**
   * توليد فاتورة لوظيفة مكتملة.
   * payload: { job_id: string }
   */
  generate_invoice: async (payload) => {
    const supabase = createSupabaseAdminClient();
    const jobId = String(payload.job_id);
    if (!jobId) throw new Error('job_id مطلوب في payload');

    const { data, error } = await supabase.rpc('fn_generate_invoice_for_job' as any, {
      p_job_id: jobId,
    });
    if (error) throw new Error(`فشل توليد الفاتورة: ${error.message}`);
    return { invoice_id: data };
  },

  /**
   * إعادة احتساب رصيد عميل (مفيد بعد عمليات مالية).
   * payload: { customer_id: string }
   */
  recompute_customer_balance: async (payload) => {
    const supabase = createSupabaseAdminClient();
    const customerId = String(payload.customer_id);
    if (!customerId) throw new Error('customer_id مطلوب');

    // يكفي إعادة جلب الفواتير — التريغرات تُحدّث balance تلقائياً
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, balance')
      .eq('customer_id', customerId);

    return { invoices_checked: invoices?.length ?? 0 };
  },

  /**
   * فحص العقود التي قاربت على الانتهاء وإرسال إشعار.
   * payload: { days_before?: number }   (افتراضي: 30 يوم)
   */
  check_expiring_contracts: async (payload) => {
    const supabase = createSupabaseAdminClient();
    const daysBefore = Number(payload.days_before ?? 30);
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysBefore);

    const { data: contracts, error } = await supabase
      .from('contracts')
      .select('id, contract_no, end_date, customer_id, company_id')
      .eq('status', 'active')
      .lte('end_date', targetDate.toISOString().slice(0, 10))
      .gte('end_date', new Date().toISOString().slice(0, 10));

    if (error) throw new Error(error.message);

    // إشعار super-admins في كل company
    let notified = 0;
    for (const contract of contracts ?? []) {
      const { data: admins } = await supabase
        .from('users_profile')
        .select('id')
        .eq('company_id', (contract as any).company_id)
        .eq('is_super_admin', true);

      for (const admin of admins ?? []) {
        await supabase.rpc('fn_notify' as any, {
          p_user_id: (admin as any).id,
          p_type: 'contract_expiring',
          p_title_ar: 'عقد قارب على الانتهاء',
          p_title_en: 'Contract expiring soon',
          p_body_ar: `العقد ${(contract as any).contract_no} سينتهي في ${(contract as any).end_date}`,
          p_body_en: `Contract ${(contract as any).contract_no} expires on ${(contract as any).end_date}`,
          p_entity_type: 'contract',
          p_entity_id: (contract as any).id,
          p_action_url: `/contracts/${(contract as any).id}`,
        });
        notified++;
      }
    }

    return { contracts_checked: contracts?.length ?? 0, notifications_sent: notified };
  },

  /**
   * فحص الفواتير المتأخرة وإرسال إشعار يومي.
   * payload: {}
   */
  check_overdue_invoices: async () => {
    const supabase = createSupabaseAdminClient();
    const today = new Date().toISOString().slice(0, 10);

    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('id, invoice_no, balance, due_date, customer_id, company_id')
      .in('status', ['issued', 'partial'])
      .lt('due_date', today)
      .gt('balance', 0);

    if (error) throw new Error(error.message);

    let notified = 0;
    for (const inv of invoices ?? []) {
      const { data: admins } = await supabase
        .from('users_profile')
        .select('id')
        .eq('company_id', (inv as any).company_id)
        .eq('is_super_admin', true);

      for (const admin of admins ?? []) {
        await supabase.rpc('fn_notify' as any, {
          p_user_id: (admin as any).id,
          p_type: 'invoice_overdue',
          p_title_ar: 'فاتورة متأخرة',
          p_title_en: 'Overdue invoice',
          p_body_ar: `الفاتورة ${(inv as any).invoice_no} — رصيد متبقّي ${(inv as any).balance} د.ك`,
          p_body_en: `Invoice ${(inv as any).invoice_no} — outstanding ${(inv as any).balance} KWD`,
          p_entity_type: 'invoice',
          p_entity_id: (inv as any).id,
          p_action_url: `/finance/invoices/${(inv as any).id}`,
        });
        notified++;
      }
    }

    return { overdue: invoices?.length ?? 0, notifications_sent: notified };
  },
};

// -----------------------------------------------------------------------------
// Worker الرئيسي
// -----------------------------------------------------------------------------

const MAX_PER_RUN = 10;        // أقصى عدد مهام في استدعاء واحد
const LOCK_DURATION_MS = 60_000;  // 60 ثانية لكل مهمة

interface RunResult {
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ job_id: string; task_type: string; error: string }>;
}

export async function runWorker(workerId: string): Promise<RunResult> {
  const result: RunResult = { processed: 0, succeeded: 0, failed: 0, errors: [] };
  const supabase = createSupabaseAdminClient();

  for (let i = 0; i < MAX_PER_RUN; i++) {
    // 1) حجز المهمة التالية
    const { data: dequeued, error: dqErr } = await supabase.rpc('fn_dequeue' as any, {
      p_worker_id: workerId,
      p_lock_for_ms: LOCK_DURATION_MS,
    });

    if (dqErr) {
      logger.error('queue.dequeue_failed', new Error(dqErr.message), { workerId });
      break;
    }

    const job = (dequeued as any[])?.[0];
    if (!job) break;  // لا توجد مهام

    result.processed++;
    const taskType = job.task_type as string;
    const handler = handlers[taskType];

    // 2) معالجة
    try {
      if (!handler) {
        throw new Error(`لا يوجد handler لـ task_type="${taskType}"`);
      }

      logger.info('queue.task_started', {
        jobId: job.id,
        taskType,
        attempt: job.attempts,
      });

      const taskResult = await handler(job.payload as Record<string, any>);

      // 3) تأكيد الإنجاز
      await supabase.rpc('fn_complete_job' as any, {
        p_job_id: job.id,
        p_result: (taskResult ?? {}) as any,
      });

      logger.info('queue.task_done', { jobId: job.id, taskType });
      result.succeeded++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error('queue.task_failed', err instanceof Error ? err : new Error(errMsg), {
        jobId: job.id,
        taskType,
        attempt: job.attempts,
      });

      // 4) تسجيل الفشل (مع retry/backoff إن لم تتجاوز المحاولات)
      await supabase.rpc('fn_fail_job' as any, {
        p_job_id: job.id,
        p_error_msg: errMsg.slice(0, 500),
      });

      result.failed++;
      result.errors.push({ job_id: job.id, task_type: taskType, error: errMsg });
    }
  }

  return result;
}
