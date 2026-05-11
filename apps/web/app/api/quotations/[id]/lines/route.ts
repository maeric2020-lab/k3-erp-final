import { NextResponse, type NextRequest } from 'next/server';
import { documentLineSchema } from '@k3/validators';
import {
  QuotationsRepository,
  DocumentLinesRepository,
  PricingRepository,
} from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface Ctx { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('document_lines')
    .select('*')
    .eq('quotation_id', params.id)
    .order('display_order', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ lines: data ?? [] });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  const parsed = documentLineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
  }
  try {
    const quotations = new QuotationsRepository(supabase);
    const lines = new DocumentLinesRepository(supabase);
    const pricing = new PricingRepository(supabase);

    const quotation = await quotations.getById(params.id);
    if (!quotation) return NextResponse.json({ error: 'quotation not found' }, { status: 404 });

    const priced = await pricing.compute({
      line_type: parsed.data.line_type,
      service_id: parsed.data.service_id ?? null,
      part_id: parsed.data.part_id ?? null,
      gas_id: parsed.data.gas_id ?? null,
      customer_machine_id: parsed.data.customer_machine_id ?? null,
      machine_master_id: parsed.data.machine_master_id ?? null,
      request_type: parsed.data.request_type ?? quotation.request_type,
      quantity: parsed.data.quantity,
    });

    const created = await lines.create({
      quotation_id: params.id,
      line_type: parsed.data.line_type,
      service_id: parsed.data.service_id ?? null,
      part_id: parsed.data.part_id ?? null,
      gas_id: parsed.data.gas_id ?? null,
      customer_machine_id: parsed.data.customer_machine_id ?? null,
      machine_master_id: parsed.data.machine_master_id ?? null,
      description_ar: parsed.data.description_ar ?? priced.description_ar,
      description_en: parsed.data.description_en ?? priced.description_en,
      unit: priced.unit,
      quantity: parsed.data.quantity,
      request_type: (parsed.data.request_type ?? quotation.request_type) as any,
      unit_price: priced.unit_price,
      cost_price: priced.cost_price,
      is_covered: priced.is_covered,
      pricing_source: priced.pricing_source,
      pricing_computed_at: new Date().toISOString(),
      notes: parsed.data.notes ?? null,
      display_order: parsed.data.display_order,
    } as any);
    return NextResponse.json({ id: created.id, line_total: created.line_total }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
