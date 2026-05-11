import { requireScreen } from '@/lib/auth/require-screen';
import { ChatThreadsRepository, UsersProfileRepository } from '@k3/repositories';
import { ChatListClient } from './chat-list-client';

export const dynamic = 'force-dynamic';

export default async function ChatListPage() {
  const ctx = await requireScreen('chat', 'view');
  const threads = new ChatThreadsRepository(ctx.supabase);
  const users = new UsersProfileRepository(ctx.supabase);

  const [summary, peers, me] = await Promise.all([
    threads.summary(),
    users.listActive(),
    users.getCurrent(),
  ]);

  // Filter out the current user from the peer list (used for new DM picker)
  const otherUsers = peers.filter((u) => u.id !== me?.id);

  return (
    <ChatListClient
      initialSummary={summary}
      otherUsers={otherUsers.map((u) => ({
        id: u.id,
        name: u.full_name_ar ?? u.full_name_en ?? u.email,
      }))}
      currentUserId={me?.id ?? ''}
    />
  );
}
