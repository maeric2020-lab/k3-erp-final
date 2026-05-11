import { NextResponse, type NextRequest } from 'next/server';
import { maintenanceRequestSchema } from '@k3/validators';
import { MaintenanceRequestsRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const supabase = createSupabaseServerClient();
  const repo = new MaintenanceRequestsRepository(supabase);
  try {
    const rows = await repo.list({
      search: searchParams.get('q'),
      limit: Number(searchParams.get('limit') ?? 50),
      offset: Number(searchParams.get('offset') ?? 0),
      order_by: 'created_at',
      ascending: false,
    });
    const total = await repo.count({ search: searchParams.get('q') });
    return NextResponse.json({ rows, total });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  const parsed = maintenanceRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
  }
  try {
    const repo = new MaintenanceRequestsRepository(supabase);
    const created = await repo.create(parsed.data as any);
    return NextResponse.json({ id: created.id, request_no: created.request_no }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
