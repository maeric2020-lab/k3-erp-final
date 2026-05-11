import { NextResponse, type NextRequest } from 'next/server';
import { contractClauseSchema } from '@k3/validators';
import { ContractClausesRepository } from '@k3/repositories';
import { ContractDocumentService } from '@k3/services';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface Ctx { params: { id: string } }

export async function GET(req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const repo = new ContractClausesRepository(supabase);
  const auto = searchParams.get('materialise') === 'true';
  if (auto) {
    const svc = new ContractDocumentService(supabase);
    const clauses = await svc.materialiseClauses(params.id);
    return NextResponse.json({ clauses });
  }
  const clauses = await repo.listForContract(params.id);
  return NextResponse.json({ clauses });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  const parsed = contractClauseSchema.safeParse({ ...(body ?? {}), contract_id: params.id });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
  }
  try {
    const repo = new ContractClausesRepository(supabase);
    const created = await repo.create(parsed.data as any);
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
