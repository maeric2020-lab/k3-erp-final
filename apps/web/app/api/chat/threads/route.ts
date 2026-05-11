import { NextResponse, type NextRequest } from 'next/server';
import { ChatThreadsRepository, UsersProfileRepository } from '@k3/repositories';
import { chatGroupCreateSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createSupabaseServerClient();
  try {
    const repo = new ChatThreadsRepository(supabase);
    const summary = await repo.summary();
    return NextResponse.json({ rows: summary });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  const parsed = chatGroupCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
  }
  try {
    const profiles = new UsersProfileRepository(supabase);
    const me = await profiles.getCurrent();
    if (!me) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    const repo = new ChatThreadsRepository(supabase);
    const threadId = await repo.createGroup(parsed.data.name, parsed.data.member_ids, me.id);
    return NextResponse.json({ thread_id: threadId }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
