import { NextResponse, type NextRequest } from 'next/server';
import { customerSiteSchema } from '@k3/validators';
import { CustomerSitesRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface Ctx { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const repo = new CustomerSitesRepository(supabase);
  const sites = await repo.listForCustomer(params.id);
  return NextResponse.json({ sites });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  const merged = { ...(body ?? {}), customer_id: params.id };
  const parsed = customerSiteSchema.safeParse(merged);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
  }
  try {
    const repo = new CustomerSitesRepository(supabase);
    const created = await repo.create(parsed.data as any);
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
