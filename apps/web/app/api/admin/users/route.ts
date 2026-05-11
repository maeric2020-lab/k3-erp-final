import { NextResponse, type NextRequest } from 'next/server';
import { userProfileSchema } from '@k3/validators';
import { UsersProfileRepository, PermissionsRepository } from '@k3/repositories';
import { UserInvitationService } from '@k3/services';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const perms = new PermissionsRepository(supabase);
  if (!(await perms.hasScreenPermission('users', 'view')) && !(await perms.isSuperAdmin())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const repo = new UsersProfileRepository(supabase);
  try {
    const rows = await repo.listAll({
      search: searchParams.get('q'),
      include_archived: searchParams.get('include_archived') === 'true',
    });
    return NextResponse.json({ rows, total: rows.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const perms = new PermissionsRepository(supabase);
  if (!(await perms.hasScreenPermission('users', 'add')) && !(await perms.isSuperAdmin())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = userProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
  }
  try {
    const origin = new URL(req.url).origin;
    const adminDb = createSupabaseAdminClient();
    const svc = new UserInvitationService(adminDb);
    const profile = await svc.invite({
      email: parsed.data.email,
      full_name_ar: parsed.data.full_name_ar,
      full_name_en: parsed.data.full_name_en,
      phone: parsed.data.phone,
      technician_code: parsed.data.technician_code,
      is_super_admin: parsed.data.is_super_admin,
      is_active: parsed.data.is_active,
      redirect_to: `${origin}/login`,
    });
    return NextResponse.json({ id: profile.id, email: profile.email }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
