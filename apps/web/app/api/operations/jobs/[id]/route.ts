import { NextResponse, type NextRequest } from 'next/server';
import { JobsRepository, DocumentLinesRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface Ctx { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const jobs = new JobsRepository(supabase);
  const lines = new DocumentLinesRepository(supabase);
  const job = await jobs.getById(params.id);
  if (!job) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const jobLines = await lines.listForJob(params.id);
  return NextResponse.json({ job, lines: jobLines });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  // Admin-only direct edits to job fields (notes, technician_id reassignment etc.)
  // Status changes are NOT allowed here — they go through /step.
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => ({}));
  if ('status' in (body ?? {})) {
    return NextResponse.json({ error: 'status changes must use /step endpoint' }, { status: 400 });
  }
  try {
    const repo = new JobsRepository(supabase);
    const updated = await repo.update(params.id, body as any);
    return NextResponse.json({ id: updated.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
