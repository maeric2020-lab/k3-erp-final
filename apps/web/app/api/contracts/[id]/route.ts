import { NextResponse, type NextRequest } from 'next/server';
import { contractSchema } from '@k3/validators';
import { ContractsRepository, ContractMachinesRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface Ctx { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const contracts = new ContractsRepository(supabase);
  const cm = new ContractMachinesRepository(supabase);
  const contract = await contracts.getById(params.id);
  if (!contract) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const machines = await cm.listForContract(params.id);
  return NextResponse.json({ contract, machines });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  const parsed = contractSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
  }
  try {
    const repo = new ContractsRepository(supabase);
    const updated = await repo.update(params.id, parsed.data as any);
    return NextResponse.json({ id: updated.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  try {
    const repo = new ContractsRepository(supabase);
    await repo.softDelete(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
