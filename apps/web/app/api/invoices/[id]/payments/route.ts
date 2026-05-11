import { type NextRequest } from 'next/server';
import { paymentSchema } from '@k3/validators';
import { PaymentsRepository, InvoicesRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { withErrorHandler, ApiError, ApiErrors } from '@/lib/api/error-handler';
import { checkIdempotency, storeIdempotency } from '@/lib/api/idempotency';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

interface Ctx { params: { id: string } }

export const GET = withErrorHandler(async (req: Request, { params }: any) => {
  const ctx = params as Ctx['params'];
  const supabase = createSupabaseServerClient();
  const repo = new PaymentsRepository(supabase);
  const rows = await repo.listForInvoice(ctx.id);
  return Response.json({ rows });
});

export const POST = withErrorHandler(async (req: Request, { params }: any) => {
  const ctx = params as Ctx['params'];
  const supabase = createSupabaseServerClient();

  // 1) المصادقة
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw ApiErrors.unauthorized();

  // 2) Rate limit (5 دفعات/10 ثوانٍ — حماية من الضغط المتكرر)
  const rateLimitResp = await checkRateLimit('payment.create', 5, 10_000, req, { userId: user.id });
  if (rateLimitResp) return rateLimitResp;

  // 3) Idempotency — إذا أُرسل Idempotency-Key سابقاً، نُعيد نفس النتيجة
  const cached = await checkIdempotency(req, user.id);
  if (cached) return cached;

  // 4) جلب الفاتورة + التحقق
  const invoices = new InvoicesRepository(supabase);
  const invoice = await invoices.getById(ctx.id);
  if (!invoice) throw ApiErrors.notFound('الفاتورة غير موجودة');

  // 5) التحقق من الـ payload (zod)
  const body = await req.json().catch(() => null);
  const parsed = paymentSchema.safeParse({
    ...(body ?? {}),
    invoice_id: ctx.id,
    customer_id: invoice.customer_id,
  });
  if (!parsed.success) {
    throw ApiErrors.badRequest(
      parsed.error.errors[0]?.message ?? 'بيانات غير صحيحة',
      { issues: parsed.error.errors }
    );
  }

  // 6) منع الدفع الزائد
  const newBalance = Number(invoice.balance) - Number(parsed.data.amount);
  if (newBalance < -0.001) {
    throw new ApiError(400, 'overpayment', 'الدفعة تتجاوز رصيد الفاتورة', {
      balance: invoice.balance,
      amount: parsed.data.amount,
    });
  }

  // 7) التنفيذ
  const repo = new PaymentsRepository(supabase);
  const created = await repo.create(parsed.data as any);

  logger.info('payment.created', {
    paymentId: created.id,
    invoiceId: ctx.id,
    amount: parsed.data.amount,
    userId: user.id,
  });

  const response = Response.json(
    { id: created.id, payment_no: created.payment_no },
    { status: 201 }
  );

  // 8) خزّن النتيجة لـ idempotency
  return await storeIdempotency(req, user.id, response);
});
