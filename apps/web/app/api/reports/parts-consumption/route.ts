import { NextResponse, type NextRequest } from 'next/server';
import { ReportsRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from_date');
  const to = searchParams.get('to_date');
  if (!from || !to) return NextResponse.json({ error: 'from_date and to_date are required' }, { status: 400 });
  try {
    const repo = new ReportsRepository(supabase);
    const rows = await repo.partsConsumption(from, to);
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
