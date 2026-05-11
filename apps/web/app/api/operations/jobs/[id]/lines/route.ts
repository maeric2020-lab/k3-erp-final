import { NextResponse, type NextRequest } from 'next/server';
import { documentLineSchema } from '@k3/validators';
import { JobsService } from '@k3/services';
import { DocumentLinesRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface Ctx { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const repo = new DocumentLinesRepository(supabase);
  const lines = await repo.listForJob(params.id);
  return NextResponse.json({ lines });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  const parsed = documentLineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
  }
  try {
    const svc = new JobsService(supabase);
    const line = await svc.addLine({
      job_id: params.id,
      line_type: parsed.data.line_type,
      service_id: parsed.data.service_id ?? null,
      part_id: parsed.data.part_id ?? null,
      gas_id: parsed.data.gas_id ?? null,
      customer_machine_id: parsed.data.customer_machine_id ?? null,
      machine_master_id: parsed.data.machine_master_id ?? null,
      quantity: parsed.data.quantity,
      description_ar: parsed.data.description_ar,
      description_en: parsed.data.description_en ?? null,
      notes: parsed.data.notes ?? null,
      display_order: parsed.data.display_order,
      // custom_unit_price is NOT accepted from the body — admin-only override
      // happens via a separate /lines/[lineId] PATCH path with permission check.
    });
    return NextResponse.json({ id: line.id, unit_price: line.unit_price, line_total: line.line_total }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
