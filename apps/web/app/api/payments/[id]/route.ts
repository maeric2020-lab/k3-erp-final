import { NextResponse, type NextRequest } from 'next/server';
import { PaymentsRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface Ctx { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const repo = new PaymentsRepository(supabase);
  const row = await repo.getById(params.id);
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  // Deletes a payment — invoice.amount_paid recalculates via the trigger.
  const supabase = createSupabaseServerClient();
  try {
    const repo = new PaymentsRepository(supabase);
    await repo.hardDelete(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
