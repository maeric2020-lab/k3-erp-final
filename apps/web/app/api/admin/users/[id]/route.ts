import { NextResponse, type NextRequest } from 'next/server';
import { userProfileUpdateSchema } from '@k3/validators';
import { UsersProfileRepository, PermissionsRepository } from '@k3/repositories';
import { UserInvitationService } from '@k3/services';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

interface Ctx { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const perms = new PermissionsRepository(supabase);
  if (!(await perms.hasScreenPermission('users', 'view')) && !(await perms.isSuperAdmin())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const repo = new UsersProfileRepository(supabase);
  const profile = await repo.getById(params.id);
  if (!profile) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(profile);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const perms = new PermissionsRepository(supabase);
  if (!(await perms.hasScreenPermission('users', 'edit')) && !(await perms.isSuperAdmin())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = userProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
  }
  try {
    const repo = new UsersProfileRepository(supabase);
    const updated = await repo.update(params.id, parsed.data as any);
    return NextResponse.json({ id: updated.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const perms = new PermissionsRepository(supabase);
  if (!(await perms.hasScreenPermission('users', 'delete')) && !(await perms.isSuperAdmin())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const adminDb = createSupabaseAdminClient();
    const svc = new UserInvitationService(adminDb);
    await svc.archive(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
