import { NextResponse, type NextRequest } from 'next/server';
import { jobCreateSchema } from '@k3/validators';
import { JobsRepository } from '@k3/repositories';
import { JobsService } from '@k3/services';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const repo = new JobsRepository(supabase);
  try {
    const status = searchParams.get('status');
    const technicianId = searchParams.get('technician_id');
    let rows;
    if (technicianId) {
      rows = await repo.listForTechnician(technicianId, { active_only: searchParams.get('active_only') === 'true' });
    } else if (status) {
      rows = await repo.listByStatus(status.split(','));
    } else {
      rows = await repo.list({
        search: searchParams.get('q'),
        limit: Number(searchParams.get('limit') ?? 50),
        offset: Number(searchParams.get('offset') ?? 0),
        order_by: 'created_at',
        ascending: false,
      });
    }
    const total = await repo.count({ search: searchParams.get('q') });
    return NextResponse.json({ rows, total });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  const parsed = jobCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
  }
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const svc = new JobsService(supabase);
    const job = await svc.createFromRequest({
      request_id: parsed.data.request_id,
      technician_id: parsed.data.technician_id ?? null,
      created_by: user?.id ?? null,
    });
    return NextResponse.json({ id: job.id, job_no: job.job_no }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
