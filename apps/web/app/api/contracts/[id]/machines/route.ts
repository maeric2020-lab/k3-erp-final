import { NextResponse, type NextRequest } from 'next/server';
import { contractMachineSchema } from '@k3/validators';
import { ContractMachinesRepository, PricingRepository, CustomerMachinesRepository, ContractsRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface Ctx { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const repo = new ContractMachinesRepository(supabase);
  const machines = await repo.listForContract(params.id);
  return NextResponse.json({ machines });
}

/**
 * POST attaches a customer_machine to the contract. The unit_price_at_signing
 * is computed from contract_pricing via compute_line_pricing — the request
 * body only specifies which machine; pricing comes from the catalog.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  const parsed = contractMachineSchema.partial({ unit_price_at_signing: true }).safeParse({
    ...(body ?? {}),
    contract_id: params.id,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
  }
  try {
    const contracts = new ContractsRepository(supabase);
    const machines = new CustomerMachinesRepository(supabase);
    const pricing = new PricingRepository(supabase);
    const cm = new ContractMachinesRepository(supabase);

    const contract = await contracts.getById(params.id);
    if (!contract) return NextResponse.json({ error: 'contract not found' }, { status: 404 });
    const machine = await machines.getById(parsed.data.customer_machine_id!);
    if (!machine) return NextResponse.json({ error: 'machine not found' }, { status: 404 });

    // Map (contract_type, is_4_year) → request_type for compute_line_pricing
    const requestType = contract.is_4_year ? `${contract.contract_type}G` : contract.contract_type;
    const priced = await pricing.compute({
      line_type: 'contract_unit',
      customer_machine_id: machine.id,
      request_type: requestType,
    });

    const created = await cm.create({
      contract_id: params.id,
      customer_machine_id: machine.id,
      unit_price_at_signing: priced.unit_price,
      notes: parsed.data.notes ?? null,
    } as any);

    return NextResponse.json({ id: created.id, unit_price: created.unit_price_at_signing }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
