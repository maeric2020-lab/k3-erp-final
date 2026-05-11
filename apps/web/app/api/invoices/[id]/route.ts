import { NextResponse, type NextRequest } from 'next/server';
import { invoiceSchema } from '@k3/validators';
import { InvoicesRepository, PaymentsRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface Ctx { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const repo = new InvoicesRepository(supabase);
  const payments = new PaymentsRepository(supabase);
  const invoice = await repo.getById(params.id);
  if (!invoice) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const [{ data: lines }, paymentRows] = await Promise.all([
    supabase.from('document_lines').select('*').eq('invoice_id', params.id).order('display_order', { ascending: true }),
    payments.listForInvoice(params.id),
  ]);
  return NextResponse.json({ invoice, lines: lines ?? [], payments: paymentRows });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  const parsed = invoiceSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
  }
  try {
    const repo = new InvoicesRepository(supabase);
    const updated = await repo.update(params.id, parsed.data as any);
    return NextResponse.json({ id: updated.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
