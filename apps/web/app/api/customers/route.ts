import { NextResponse, type NextRequest } from 'next/server';
import { customerSchema } from '@k3/validators';
import { CustomersRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
  }
  try {
    const repo = new CustomersRepository(supabase);
    const created = await repo.create(parsed.data as any);
    return NextResponse.json({ id: created.id, code: created.code }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
