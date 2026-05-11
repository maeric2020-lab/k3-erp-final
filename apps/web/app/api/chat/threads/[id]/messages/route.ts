import { NextResponse, type NextRequest } from 'next/server';
import { ChatMessagesRepository, UsersProfileRepository } from '@k3/repositories';
import { chatMessageInputSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface Ctx { params: { id: string } }

export async function GET(req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  try {
    const repo = new ChatMessagesRepository(supabase);
    const rows = await repo.list(params.id, {
      before: searchParams.get('before') ?? undefined,
      limit: Number(searchParams.get('limit') ?? 100),
    });
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => null);
  const parsed = chatMessageInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
  }
  try {
    const profiles = new UsersProfileRepository(supabase);
    const me = await profiles.getCurrent();
    if (!me) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    const repo = new ChatMessagesRepository(supabase);
    const msg = await repo.send(
      params.id,
      me.id,
      parsed.data.body ?? null,
      parsed.data.attachments ?? []
    );
    return NextResponse.json({ id: msg.id, created_at: msg.created_at }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
