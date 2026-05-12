import { NextResponse, type NextRequest } from 'next/server';
import { ImportsRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const repo = new ImportsRepository(supabase);
  const runs = await repo.listRuns({
    template_type: searchParams.get('template') ?? undefined,
    limit: Number(searchParams.get('limit') ?? 50),
  });
  return NextResponse.json({ runs });
}
