import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { UserPermissionsAdminRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface Ctx { params: { id: string } }

const schema = z.object({ active: z.boolean() });

export async function POST(req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  try {
    const repo = new UserPermissionsAdminRepository(supabase);
    await repo.setUserActive(params.id, parsed.data.active);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
