import { NextResponse, type NextRequest } from 'next/server';
import { quotationSchema } from '@k3/validators';
import { QuotationsRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const repo = new QuotationsRepository(supabase);
  try {
    const customerId = searchParams.get('customer_id');
    if (customerId) {
      const rows = await repo.listForCustomer(customerId);
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
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  const parsed = quotationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
  }
  try {
    const repo = new QuotationsRepository(supabase);
    const created = await repo.create(parsed.data as any);
    return NextResponse.json({ id: created.id, quotation_no: created.quotation_no }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
