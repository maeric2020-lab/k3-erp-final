import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ChatThreadsRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const schema = z.object({ user_id: z.string().uuid() });

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  try {
    const repo = new ChatThreadsRepository(supabase);
    const threadId = await repo.createOrGetDm(parsed.data.user_id);
    return NextResponse.json({ thread_id: threadId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
