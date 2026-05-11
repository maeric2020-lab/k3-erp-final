import { NextResponse, type NextRequest } from 'next/server';
import { ChatThreadsRepository, UsersProfileRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface Ctx { params: { id: string } }

export async function POST(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  try {
    const profiles = new UsersProfileRepository(supabase);
    const me = await profiles.getCurrent();
    if (!me) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    const repo = new ChatThreadsRepository(supabase);
    await repo.markRead(params.id, me.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
