import { NextResponse } from 'next/server';
import { ReportsRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createSupabaseServerClient();
  try {
    const repo = new ReportsRepository(supabase);
    const rows = await repo.customerBalances();
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
