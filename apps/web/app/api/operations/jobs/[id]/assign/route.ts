import { NextResponse, type NextRequest } from 'next/server';
import { jobAssignTechSchema } from '@k3/validators';
import { JobsRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface Ctx { params: { id: string } }

export async function POST(req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  const parsed = jobAssignTechSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
  }
  try {
    const repo = new JobsRepository(supabase);
    const updated = await repo.update(params.id, { technician_id: parsed.data.technician_id } as any);
    return NextResponse.json({ id: updated.id, technician_id: updated.technician_id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
