import { NextResponse } from 'next/server';
import { bootstrapAdminSchema } from '@k3/validators';
import { SetupService, SetupAlreadyCompleteError } from '@k3/services';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/setup
 *
 * One-shot endpoint that creates the first super_admin.
 * Refuses to run if a super_admin already exists.
 *
 * Uses the service-role client because:
 *   - No authenticated user exists yet → anon client cannot read users_profile
 *   - We need to create the auth user via auth.admin endpoints
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = bootstrapAdminSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();
    const setup = new SetupService(admin);

    const result = await setup.createFirstAdmin({
      email: parsed.data.email,
      password: parsed.data.password,
      full_name_ar: parsed.data.full_name_ar,
      full_name_en: parsed.data.full_name_en ?? null,
    });

    return NextResponse.json({ ok: true, userId: result.userId });
  } catch (e: any) {
    if (e instanceof SetupAlreadyCompleteError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    return NextResponse.json({ error: e?.message ?? 'Setup failed' }, { status: 500 });
  }
}
