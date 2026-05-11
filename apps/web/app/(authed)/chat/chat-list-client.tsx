'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Plus, Users, MessageCircle, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import type { ChatThreadSummary } from '@k3/repositories';

interface PeerUser { id: string; name: string }
interface Props {
  initialSummary: ChatThreadSummary[];
  otherUsers: PeerUser[];
  currentUserId: string;
}

function formatRelative(iso: string | null, locale: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  if (diff < 60_000) return locale === 'ar' ? 'الآن' : 'now';
  if (diff < 60 * 60 * 1000) {
    const mins = Math.floor(diff / 60_000);
    return locale === 'ar' ? `قبل ${mins} د` : `${mins}m ago`;
  }
  if (diff < oneDay) {
    return d.toLocaleTimeString(locale === 'ar' ? 'ar-KW' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 7 * oneDay) {
    return d.toLocaleDateString(locale === 'ar' ? 'ar-KW' : 'en-US', { weekday: 'short' });
  }
  return d.toLocaleDateString(locale === 'ar' ? 'ar-KW' : 'en-US', { month: 'short', day: 'numeric' });
}

export function ChatListClient({ initialSummary, otherUsers, currentUserId }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [summary, setSummary] = useState(initialSummary);
  const [search, setSearch] = useState('');

  const [showNewDm, setShowNewDm] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredThreads = search
    ? summary.filter((s) => {
        const label = s.is_group ? (s.name ?? '') : (s.other_user_name ?? '');
        return label.toLowerCase().includes(search.toLowerCase()) ||
          (s.last_message_preview ?? '').toLowerCase().includes(search.toLowerCase());
      })
    : summary;

  const filteredUsers = search && showNewDm
    ? otherUsers.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()))
    : otherUsers;

  const startDm = async (userId: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/chat/dm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      const body = await res.json();
      router.push(`/chat/${body.thread_id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim() || groupMemberIds.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/chat/threads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName.trim(), member_ids: [...groupMemberIds] }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      const body = await res.json();
      router.push(`/chat/${body.thread_id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleGroupMember = (id: string) => {
    setGroupMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-gray-400" />
          {t('chat.title')}
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setShowNewDm(!showNewDm); setShowNewGroup(false); setSearch(''); }}>
            <Plus className="w-4 h-4 me-1" />{t('chat.newDm')}
          </Button>
          <Button size="sm" onClick={() => { setShowNewGroup(!showNewGroup); setShowNewDm(false); setSearch(''); }}>
            <Users className="w-4 h-4 me-1" />{t('chat.newGroup')}
          </Button>
        </div>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      {showNewDm && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t('chat.newDm')}</h2>
            <button onClick={() => setShowNewDm(false)} className="p-1 rounded hover:bg-gray-100">
              <X className="w-4 h-4" />
            </button>
          </div>
          <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} dir="auto" />
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 -mx-4">
            {filteredUsers.length === 0 ? (
              <p className="text-sm text-gray-500 px-4 py-3">{t('common.noData')}</p>
            ) : filteredUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => startDm(u.id)}
                disabled={busy}
                className="w-full text-start px-4 py-2.5 hover:bg-brand-50 disabled:opacity-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold">
                    {u.name.charAt(0)}
                  </div>
                  <span dir="auto">{u.name}</span>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {showNewGroup && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t('chat.newGroup')}</h2>
            <button onClick={() => setShowNewGroup(false)} className="p-1 rounded hover:bg-gray-100">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div>
            <Label htmlFor="gname" required>{t('chat.groupName')}</Label>
            <Input id="gname" value={groupName} onChange={(e) => setGroupName(e.target.value)} dir="auto" />
          </div>
          <div>
            <Label>{t('chat.selectMembers')} ({groupMemberIds.size})</Label>
            <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} dir="auto" className="mb-2" />
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
              {filteredUsers.length === 0 ? (
                <p className="text-sm text-gray-500 px-3 py-3">{t('common.noData')}</p>
              ) : filteredUsers.map((u) => (
                <label key={u.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    checked={groupMemberIds.has(u.id)}
                    onChange={() => toggleGroupMember(u.id)}
                  />
                  <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold">
                    {u.name.charAt(0)}
                  </div>
                  <span dir="auto">{u.name}</span>
                </label>
              ))}
            </div>
          </div>
          <Button onClick={createGroup} disabled={busy || !groupName.trim() || groupMemberIds.size === 0}>
            {busy ? t('common.loading') : t('chat.create')}
          </Button>
        </Card>
      )}

      {/* Search bar for thread list when not in new-DM/new-group mode */}
      {!showNewDm && !showNewGroup && (
        <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} dir="auto" />
      )}

      {/* Thread list */}
      <Card className="overflow-hidden">
        {filteredThreads.length === 0 ? (
          <p className="text-sm text-gray-500 p-8 text-center">{t('chat.noThreads')}</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredThreads.map((th) => {
              const label = th.is_group ? (th.name ?? '—') : (th.other_user_name ?? '—');
              const isUnread = th.unread_count > 0;
              return (
                <Link
                  key={th.thread_id}
                  href={`/chat/${th.thread_id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold ${
                    th.is_group ? 'bg-brand-100 text-brand-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {th.is_group ? <Users className="w-5 h-5" /> : label.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate ${isUnread ? 'font-semibold text-gray-900' : 'text-gray-700'}`} dir="auto">
                        {label}
                        {th.is_group && <span className="text-xs text-gray-400 ms-2 font-normal">({th.member_count})</span>}
                      </span>
                      <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                        {formatRelative(th.last_message_at, locale)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className={`text-sm truncate ${isUnread ? 'text-gray-900' : 'text-gray-500'}`} dir="auto">
                        {th.last_sender_id === currentUserId && th.last_message_preview ? `${t('chat.you')}: ` : ''}
                        {th.last_message_preview ?? <span className="italic text-gray-400">{t('chat.noMessages')}</span>}
                      </span>
                      {isUnread && (
                        <span className="px-1.5 py-0.5 rounded-full bg-brand-600 text-white text-[10px] font-semibold flex-shrink-0">
                          {th.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
