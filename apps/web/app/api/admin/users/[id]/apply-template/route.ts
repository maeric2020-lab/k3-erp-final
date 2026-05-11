import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { UserPermissionsAdminRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface Ctx { params: { id: string } }

const schema = z.object({
  template_id: z.string().uuid(),
  replace: z.boolean().default(false),
});

export async function POST(req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
  }
  try {
    const repo = new UserPermissionsAdminRepository(supabase);
    const inserted = await repo.applyTemplate(params.id, parsed.data.template_id, parsed.data.replace);
    return NextResponse.json({ ok: true, inserted });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
