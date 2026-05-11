import { NextResponse, type NextRequest } from 'next/server';
import { ImportService, getImporterForTemplate } from '@k3/services';
import { ImportsRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  try {
    const body = await req.json().catch(() => null);
    const runId = body?.runId;
    if (!runId || typeof runId !== 'string') {
      return NextResponse.json({ error: 'runId required' }, { status: 400 });
    }

    const repo = new ImportsRepository(supabase);
    const run = await repo.getRun(runId);
    if (!run) return NextResponse.json({ error: 'run not found' }, { status: 404 });
    if (run.status !== 'previewing') {
      return NextResponse.json({ error: `run is in status "${run.status}", not previewing` }, { status: 400 });
    }

    const svc = new ImportService(supabase);
    const importer = getImporterForTemplate(run.template_type);
    const result = await svc.commit(runId, importer);

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
