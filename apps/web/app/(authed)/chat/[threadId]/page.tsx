import { requireScreen } from '@/lib/auth/require-screen';
import {
  ChatThreadsRepository,
  ChatMessagesRepository,
  UsersProfileRepository,
} from '@k3/repositories';
import { notFound } from 'next/navigation';
import { ChatThreadClient } from './chat-thread-client';

export const dynamic = 'force-dynamic';

interface PageProps { params: { threadId: string } }

export default async function ChatThreadPage({ params }: PageProps) {
  const ctx = await requireScreen('chat', 'view');
  const threads = new ChatThreadsRepository(ctx.supabase);
  const messages = new ChatMessagesRepository(ctx.supabase);
  const profiles = new UsersProfileRepository(ctx.supabase);

  const thread = await threads.getById(params.threadId);
  if (!thread) notFound();

  const [me, members, initialMessages] = await Promise.all([
    profiles.getCurrent(),
    threads.listMembers(params.threadId),
    messages.list(params.threadId, { limit: 50 }),
  ]);
  if (!me) notFound();

  // Mark read on entry
  await threads.markRead(params.threadId, me.id).catch(() => {});

  // Determine the title
  let title = thread.name ?? '—';
  if (!thread.is_group) {
    const other = members.find((m) => m.user_id !== me.id);
    title = other?.user_name ?? '—';
  }

  return (
    <ChatThreadClient
      threadId={params.threadId}
      title={title}
      isGroup={thread.is_group}
      currentUserId={me.id}
      initialMessages={initialMessages}
      members={members.map((m) => ({ id: m.user_id, name: m.user_name ?? '—' }))}
    />
  );
}
