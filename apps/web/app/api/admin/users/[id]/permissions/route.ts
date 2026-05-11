import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { permissionGrantSchema, PERMISSION_ACTIONS } from '@k3/validators';
import { UserPermissionsAdminRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface Ctx { params: { id: string } }

const replaceSchema = z.object({
  grants: z.array(z.object({
    screen_code: z.string().min(1),
    action: z.enum(PERMISSION_ACTIONS),
  })),
});

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  try {
    const repo = new UserPermissionsAdminRepository(supabase);
    const grid = await repo.grid(params.id);
    return NextResponse.json({ grid });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  const parsed = replaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
  }
  try {
    const repo = new UserPermissionsAdminRepository(supabase);
    await repo.replaceForUser(params.id, parsed.data.grants);
    return NextResponse.json({ ok: true, count: parsed.data.grants.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  // Single grant toggle. Body: { screen_code, action, granted }
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  const parsed = permissionGrantSchema.safeParse({ ...(body ?? {}), user_id: params.id });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
  }
  try {
    const repo = new UserPermissionsAdminRepository(supabase);
    await repo.setGrant(params.id, parsed.data.screen_code, parsed.data.action, parsed.data.granted);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
