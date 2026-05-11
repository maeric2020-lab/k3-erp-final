import { NextResponse, type NextRequest } from 'next/server';
import { ChatThreadsRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface Ctx { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  try {
    const repo = new ChatThreadsRepository(supabase);
    const members = await repo.listMembers(params.id);
    return NextResponse.json({ rows: members });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
