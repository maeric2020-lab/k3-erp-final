import type { K3SupabaseClient, Database, Tables } from '@k3/shared-types';

export type ChatThread = Tables<'chat_threads'>;
export type ChatThreadMember = Tables<'chat_thread_members'>;
export type ChatMessage = Tables<'chat_messages'>;

export interface ChatAttachment {
  name: string;
  mime: string;
  size: number;
  storage_path: string;
}

export interface ChatThreadSummary {
  thread_id: string;
  is_group: boolean;
  name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_sender_id: string | null;
  unread_count: number;
  other_user_id: string | null;
  other_user_name: string | null;
  member_count: number;
}

export interface ChatMessageWithSender extends ChatMessage {
  sender_name?: string | null;
}

export class ChatThreadsRepository {
  constructor(private readonly db: K3SupabaseClient) {}

  /** List threads for the current user with last message + unread count. */
  async summary(): Promise<ChatThreadSummary[]> {
    const { data, error } = await this.db.rpc('fn_chat_thread_summary' as any);
    if (error) throw error;
    return (data ?? []) as ChatThreadSummary[];
  }

  async getById(id: string): Promise<ChatThread | null> {
    const { data, error } = await this.db.from('chat_threads').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  /** Wraps fn_chat_create_or_get_dm. */
  async createOrGetDm(otherUserId: string): Promise<string> {
    const { data, error } = await this.db.rpc('fn_chat_create_or_get_dm' as any, {
      p_other_user_id: otherUserId,
    });
    if (error) throw error;
    if (!data) throw new Error('No thread id returned');
    return String(data);
  }

  /** Create a group thread with the given name and members. */
  async createGroup(name: string, memberIds: string[], creatorId: string): Promise<string> {
    const { data: thread, error: tErr } = await this.db
      .from('chat_threads')
      .insert({ name, is_group: true, created_by: creatorId })
      .select('id')
      .single();
    if (tErr) throw tErr;
    const threadId = thread.id;
    const ids = Array.from(new Set([...memberIds, creatorId]));
    const rows = ids.map((user_id) => ({ thread_id: threadId, user_id }));
    const { error: mErr } = await this.db.from('chat_thread_members').insert(rows);
    if (mErr) throw mErr;
    return threadId;
  }

  async listMembers(threadId: string): Promise<Array<ChatThreadMember & { user_name: string | null }>> {
    const { data, error } = await this.db
      .from('chat_thread_members')
      .select('*, users_profile!inner(full_name_ar, full_name_en, email)')
      .eq('thread_id', threadId);
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      ...row,
      user_name: row.users_profile?.full_name_ar
        ?? row.users_profile?.full_name_en
        ?? row.users_profile?.email
        ?? null,
    }));
  }

  /** Mark all messages in a thread as read by the current user up to now. */
  async markRead(threadId: string, userId: string): Promise<void> {
    const { error } = await this.db
      .from('chat_thread_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('thread_id', threadId)
      .eq('user_id', userId);
    if (error) throw error;
  }

  async setMuted(threadId: string, userId: string, muted: boolean): Promise<void> {
    const { error } = await this.db
      .from('chat_thread_members')
      .update({ is_muted: muted })
      .eq('thread_id', threadId)
      .eq('user_id', userId);
    if (error) throw error;
  }
}

export class ChatMessagesRepository {
  constructor(private readonly db: K3SupabaseClient) {}

  async list(threadId: string, opts: { before?: string; limit?: number } = {}): Promise<ChatMessageWithSender[]> {
    let q = this.db
      .from('chat_messages')
      .select('*, users_profile!inner(full_name_ar, full_name_en, email)')
      .eq('thread_id', threadId)
      .eq('is_deleted', false);
    if (opts.before) q = q.lt('created_at', opts.before);
    const { data, error } = await q
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 100);
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      ...row,
      sender_name: row.users_profile?.full_name_ar
        ?? row.users_profile?.full_name_en
        ?? row.users_profile?.email
        ?? null,
    })).reverse(); // chronological for the UI
  }

  async send(threadId: string, senderId: string, body: string | null, attachments: ChatAttachment[] = []): Promise<ChatMessage> {
    const { data, error } = await this.db
      .from('chat_messages')
      .insert({
        thread_id: threadId,
        sender_id: senderId,
        body: body ?? null,
        attachments: attachments as any,
      } as any)
      .select('*')
      .single();
    if (error) throw error;
    return data as ChatMessage;
  }

  async softDelete(messageId: string): Promise<void> {
    const { error } = await this.db
      .from('chat_messages')
      .update({ is_deleted: true })
      .eq('id', messageId);
    if (error) throw error;
  }
}
