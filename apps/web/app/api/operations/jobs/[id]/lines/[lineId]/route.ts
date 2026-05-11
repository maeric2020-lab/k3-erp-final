import { NextResponse, type NextRequest } from 'next/server';
import { JobsService } from '@k3/services';
import { DocumentLinesRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface Ctx { params: { id: string; lineId: string } }

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  try {
    const svc = new JobsService(supabase);
    await svc.removeLine(params.lineId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

/**
 * PATCH allows editing only the description and quantity (which triggers a
 * pricing recompute via the line_total generated column). The pricing fields
 * themselves are never editable — pricing is computed by the DB function.
 *
 * For custom-line admin override (allowing manual unit_price), see Phase 5.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  }
  const allowed: Record<string, any> = {};
  if (typeof body.description_ar === 'string') allowed.description_ar = body.description_ar.trim();
  if (typeof body.description_en === 'string') allowed.description_en = body.description_en.trim();
  if (typeof body.quantity === 'number' && body.quantity > 0) allowed.quantity = body.quantity;
  if (typeof body.notes === 'string') allowed.notes = body.notes;
  if (typeof body.display_order === 'number') allowed.display_order = body.display_order;
  try {
    const repo = new DocumentLinesRepository(supabase);
    const updated = await repo.update(params.lineId, allowed as any);
    return NextResponse.json({ id: updated.id, line_total: updated.line_total });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
