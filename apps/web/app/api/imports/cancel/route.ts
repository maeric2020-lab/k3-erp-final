import { NextResponse, type NextRequest } from 'next/server';
import { ImportService } from '@k3/services';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  try {
    const body = await req.json().catch(() => null);
    const runId = body?.runId;
    if (!runId) return NextResponse.json({ error: 'runId required' }, { status: 400 });
    const svc = new ImportService(supabase);
    await svc.cancel(runId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
