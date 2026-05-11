import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { PERMISSION_ACTIONS } from '@k3/validators';
import { PermissionTemplateItemsRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface Ctx { params: { id: string } }

const replaceSchema = z.object({
  items: z.array(z.object({
    screen_code: z.string().min(1),
    action: z.enum(PERMISSION_ACTIONS),
  })),
});

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  try {
    const repo = new PermissionTemplateItemsRepository(supabase);
    const items = await repo.listForTemplate(params.id);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  const parsed = replaceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  try {
    const repo = new PermissionTemplateItemsRepository(supabase);
    await repo.replaceItems(params.id, parsed.data.items);
    return NextResponse.json({ ok: true, count: parsed.data.items.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
