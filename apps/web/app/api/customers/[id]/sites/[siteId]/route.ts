import { NextResponse, type NextRequest } from 'next/server';
import { customerSiteSchema } from '@k3/validators';
import { CustomerSitesRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface Ctx { params: { id: string; siteId: string } }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  const parsed = customerSiteSchema.partial().safeParse({ ...(body ?? {}), customer_id: params.id });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
  }
  try {
    const repo = new CustomerSitesRepository(supabase);
    const updated = await repo.update(params.siteId, parsed.data as any);
    return NextResponse.json({ id: updated.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  try {
    const repo = new CustomerSitesRepository(supabase);
    await repo.softDelete(params.siteId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
