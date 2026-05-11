import { NextResponse, type NextRequest } from 'next/server';
import { ImportsRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface Ctx { params: { runId: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const repo = new ImportsRepository(supabase);
  const rows = await repo.listRows(params.runId);
  return NextResponse.json({ rows });
}
