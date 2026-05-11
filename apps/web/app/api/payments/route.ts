import { NextResponse, type NextRequest } from 'next/server';
import { PaymentsRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const repo = new PaymentsRepository(supabase);
  try {
    const customerId = searchParams.get('customer_id');
    if (customerId) {
      const rows = await repo.listForCustomer(customerId);
      return NextResponse.json({ rows, total: rows.length });
    }
    const rows = await repo.list({
      search: searchParams.get('q'),
      limit: Number(searchParams.get('limit') ?? 50),
      order_by: 'payment_date',
      ascending: false,
    });
    const total = await repo.count({ search: searchParams.get('q') });
    return NextResponse.json({ rows, total });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
