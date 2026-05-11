import { NextResponse, type NextRequest } from 'next/server';
import { quotationSchema } from '@k3/validators';
import { QuotationsRepository, DocumentLinesRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface Ctx { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const repo = new QuotationsRepository(supabase);
  const lines = new DocumentLinesRepository(supabase);
  const quotation = await repo.getById(params.id);
  if (!quotation) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const { data: lineRows } = await supabase
    .from('document_lines')
    .select('*')
    .eq('quotation_id', params.id)
    .order('display_order', { ascending: true });
  return NextResponse.json({ quotation, lines: lineRows ?? [] });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  const parsed = quotationSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
  }
  try {
    const repo = new QuotationsRepository(supabase);
    const updated = await repo.update(params.id, parsed.data as any);
    return NextResponse.json({ id: updated.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  try {
    const repo = new QuotationsRepository(supabase);
    await repo.softDelete(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
