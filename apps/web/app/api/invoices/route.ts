import { NextResponse, type NextRequest } from 'next/server';
import { invoiceSchema } from '@k3/validators';
import { InvoicesRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const repo = new InvoicesRepository(supabase);
  try {
    const customerId = searchParams.get('customer_id');
    const status = searchParams.get('status');
    if (customerId) {
      const rows = await repo.listForCustomer(customerId);
      return NextResponse.json({ rows, total: rows.length });
    }
    if (status === 'outstanding') {
      const rows = await repo.listOutstanding({ limit: Number(searchParams.get('limit') ?? 100) });
      return NextResponse.json({ rows, total: rows.length });
    }
    const rows = await repo.list({
      search: searchParams.get('q'),
      limit: Number(searchParams.get('limit') ?? 50),
      order_by: 'issue_date',
      ascending: false,
    });
    const total = await repo.count({ search: searchParams.get('q') });
    return NextResponse.json({ rows, total });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  // Direct invoice creation is rare — most invoices are auto-generated from
  // jobs. This endpoint exists for stand-alone invoices entered by accounting.
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  const parsed = invoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
  }
  try {
    const repo = new InvoicesRepository(supabase);
    const created = await repo.create(parsed.data as any);
    return NextResponse.json({ id: created.id, invoice_no: created.invoice_no }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
