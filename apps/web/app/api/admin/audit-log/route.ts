import { NextResponse, type NextRequest } from 'next/server';
import { AuditLogRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  try {
    const repo = new AuditLogRepository(supabase);
    const rows = await repo.list({
      user_id: searchParams.get('user_id'),
      entity_type: searchParams.get('entity_type'),
      entity_id: searchParams.get('entity_id'),
      action: searchParams.get('action'),
      from_date: searchParams.get('from_date'),
      to_date: searchParams.get('to_date'),
      limit: Number(searchParams.get('limit') ?? 200),
    });
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
}
