import { NextResponse, type NextRequest } from 'next/server';
import { jobStepSchema } from '@k3/validators';
import { JobsService } from '@k3/services';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface Ctx { params: { id: string } }

/**
 * POST /api/operations/jobs/[id]/step
 *
 * Body shape (validated by jobStepSchema):
 *   { step: 'accept' | 'on_way' | 'arrived' | 'start_inspection' | ... ,
 *     arrived_lat?: number, arrived_lng?: number,
 *     inspection_notes?, technician_notes?, signature paths? }
 *
 * The DB-level status machine (fn_jobs_status_transition) validates the
 * transition is legal; the service layer validates the payload (e.g., GPS
 * required for arrival, technician signature required for completion).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  const parsed = jobStepSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
  }
  try {
    const svc = new JobsService(supabase);
    const job = await svc.applyStep({
      job_id: params.id,
      step: parsed.data.step,
      payload: {
        arrived_lat: parsed.data.arrived_lat ?? null,
        arrived_lng: parsed.data.arrived_lng ?? null,
        inspection_notes: parsed.data.inspection_notes ?? null,
        technician_notes: parsed.data.technician_notes ?? null,
        customer_signature_name: parsed.data.customer_signature_name ?? null,
        customer_signature_path: parsed.data.customer_signature_path ?? null,
        technician_signature_path: parsed.data.technician_signature_path ?? null,
      },
    });
    return NextResponse.json({ id: job.id, status: job.status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
