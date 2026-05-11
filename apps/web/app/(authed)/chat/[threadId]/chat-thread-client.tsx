'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import {
  Send, Paperclip, Mic, Square, Trash2, ChevronLeft, X, Users, Download,
} from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { ChatMessageWithSender, ChatAttachment } from '@k3/repositories';
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_SIZE_BYTES,
} from '@k3/validators';

interface Props {
  threadId: string;
  title: string;
  isGroup: boolean;
  currentUserId: string;
  initialMessages: ChatMessageWithSender[];
  members: Array<{ id: string; name: string }>;
}

interface PendingAttachment {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  attachment?: ChatAttachment;
  error?: string;
}

const BUCKET = 'chat-attachments';

function formatTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale === 'ar' ? 'ar-KW' : 'en-US', {
    hour: '2-digit', minute: '2-digit',
  });
}

function bytesToHuman(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ChatThreadClient({
  threadId, title, isGroup, currentUserId, initialMessages, members,
}: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const supabase = createSupabaseBrowserClient();
  const [messages, setMessages] = useState<ChatMessageWithSender[]>(initialMessages);
  const [body, setBody] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordStreamRef = useRef<MediaStream | null>(null);

  // Auto-scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [scrollToBottom]); // initial
  useEffect(() => {
    // Re-scroll if user is near bottom; otherwise leave them where they are
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom) requestAnimationFrame(scrollToBottom);
  }, [messages, scrollToBottom]);

  // Realtime subscription — listens for INSERT events on chat_messages for this thread
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${threadId}`)
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${threadId}` },
        async (payload: any) => {
          const newMsg = payload.new;
          // Skip if it's already in the list (we just sent it ourselves and it's been echoed)
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, { ...newMsg, sender_name: undefined }];
          });
          // Mark read if it's not our own message
          if (newMsg.sender_id !== currentUserId) {
            try {
              await fetch(`/api/chat/threads/${threadId}/read`, { method: 'POST' });
            } catch { /* ignore */ }
          }
        }
      )
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${threadId}` },
        (payload: any) => {
          const updated = payload.new;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, threadId, currentUserId]);

  // Mark read when window regains focus / when scrolled to bottom
  useEffect(() => {
    const onFocus = () => {
      fetch(`/api/chat/threads/${threadId}/read`, { method: 'POST' }).catch(() => {});
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [threadId]);

  // File picker
  const onFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const remaining = MAX_ATTACHMENTS_PER_MESSAGE - pendingAttachments.length;
    if (files.length > remaining) {
      setError(t('chat.tooManyFiles'));
      return;
    }
    const newPending: PendingAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.size > MAX_ATTACHMENT_SIZE_BYTES) {
        setError(`${f.name}: ${t('chat.fileTooLarge')}`);
        continue;
      }
      newPending.push({
        id: `${Date.now()}_${i}_${f.name}`,
        file: f,
        status: 'pending',
      });
    }
    if (newPending.length > 0) {
      setPendingAttachments((prev) => [...prev, ...newPending]);
      setError(null);
      void uploadPending(newPending);
    }
    e.target.value = '';
  };

  // Upload one or more pending attachments
  const uploadPending = async (toUpload: PendingAttachment[]) => {
    for (const pa of toUpload) {
      setPendingAttachments((prev) => prev.map((p) => p.id === pa.id ? { ...p, status: 'uploading' } : p));
      try {
        const formData = new FormData();
        formData.append('file', pa.file);
        formData.append('thread_id', threadId);
        const res = await fetch('/api/chat/upload', { method: 'POST', body: formData });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `${res.status}`);
        }
        const body = await res.json();
        setPendingAttachments((prev) => prev.map((p) =>
          p.id === pa.id ? { ...p, status: 'uploaded', attachment: body.attachment } : p
        ));
      } catch (e) {
        setPendingAttachments((prev) => prev.map((p) =>
          p.id === pa.id ? { ...p, status: 'error', error: (e as Error).message } : p
        ));
      }
    }
  };

  const removePending = (id: string) => {
    setPendingAttachments((prev) => prev.filter((p) => p.id !== id));
  };

  // Voice recording via MediaRecorder
  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      // Choose best supported mime type
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recordChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(recordChunksRef.current, { type: mime });
        recordStreamRef.current?.getTracks().forEach((tr) => tr.stop());
        recordStreamRef.current = null;
        if (blob.size === 0) return;
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: mime });
        const pending: PendingAttachment = {
          id: `voice_${Date.now()}`,
          file,
          status: 'pending',
        };
        setPendingAttachments((prev) => [...prev, pending]);
        await uploadPending([pending]);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      recordChunksRef.current = []; // discard
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setRecording(false);
  };

  // Send message
  const send = async () => {
    const trimmedBody = body.trim();
    const uploaded = pendingAttachments.filter((p) => p.status === 'uploaded' && p.attachment);
    const pendingCount = pendingAttachments.filter((p) => p.status === 'pending' || p.status === 'uploading').length;
    if (pendingCount > 0) {
      setError(t('chat.uploading'));
      return;
    }
    if (!trimmedBody && uploaded.length === 0) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/chat/threads/${threadId}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: trimmedBody || null,
          attachments: uploaded.map((p) => p.attachment),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      // Clear composer; the realtime sub will append the message
      setBody('');
      setPendingAttachments([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  // Soft-delete a message (sender or super-admin)
  const deleteMessage = async (id: string) => {
    if (!confirm(t('common.deleteConfirm'))) return;
    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({ is_deleted: true })
        .eq('id', id);
      if (error) throw error;
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Get a signed URL for an attachment (paths are private)
  const openAttachment = async (path: string) => {
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -mx-6 -my-6 max-w-none">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white">
        <Link href="/chat" className="p-1.5 rounded hover:bg-gray-100 -ms-1">
          <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
        </Link>
        <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold ${
          isGroup ? 'bg-brand-100 text-brand-700' : 'bg-green-100 text-green-700'
        }`}>
          {isGroup ? <Users className="w-4 h-4" /> : title.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate" dir="auto">{title}</div>
          {isGroup && (
            <button onClick={() => setShowMembers(!showMembers)} className="text-xs text-gray-500 hover:underline">
              {members.length} {t('chat.members')}
            </button>
          )}
        </div>
      </div>

      {/* Members panel (group only) */}
      {showMembers && isGroup && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 max-h-32 overflow-y-auto">
          <div className="flex items-center flex-wrap gap-2">
            {members.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-gray-200 text-xs">
                <span className="w-4 h-4 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold">
                  {m.name.charAt(0)}
                </span>
                <span dir="auto">{m.id === currentUserId ? t('chat.you') : m.name}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-500">
            {t('chat.noMessages')}
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => {
              const mine = msg.sender_id === currentUserId;
              return (
                <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 shadow-sm ${
                    msg.is_deleted
                      ? 'bg-gray-200 text-gray-500 italic'
                      : mine
                        ? 'bg-brand-600 text-white'
                        : 'bg-white text-gray-900 border border-gray-100'
                  }`}>
                    {isGroup && !mine && !msg.is_deleted && (
                      <div className="text-xs font-semibold text-brand-600 mb-0.5" dir="auto">
                        {msg.sender_name ?? '—'}
                      </div>
                    )}
                    {msg.is_deleted ? (
                      <span className="text-sm">{t('chat.deletedMessage')}</span>
                    ) : (
                      <>
                        {msg.body && (
                          <p className="text-sm whitespace-pre-wrap break-words" dir="auto">{msg.body}</p>
                        )}
                        {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                          <div className={`space-y-1 ${msg.body ? 'mt-2' : ''}`}>
                            {msg.attachments.map((a: any, i: number) => {
                              const isAudio = a.mime?.startsWith('audio/');
                              return (
                                <button
                                  key={i}
                                  onClick={() => openAttachment(a.storage_path)}
                                  className={`w-full flex items-center gap-2 text-start rounded-md px-2 py-1.5 ${
                                    mine ? 'bg-brand-700 hover:bg-brand-800' : 'bg-gray-50 hover:bg-gray-100'
                                  }`}
                                >
                                  {isAudio ? <Mic className="w-4 h-4 flex-shrink-0" /> : <Download className="w-4 h-4 flex-shrink-0" />}
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium truncate" dir="auto">
                                      {isAudio ? t('chat.voiceMessage') : a.name}
                                    </div>
                                    <div className={`text-[10px] ${mine ? 'text-brand-200' : 'text-gray-500'}`}>
                                      {bytesToHuman(a.size)}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                    <div className={`flex items-center gap-2 mt-1 text-[10px] ${mine ? 'text-brand-100' : 'text-gray-400'} justify-end`}>
                      {mine && !msg.is_deleted && (
                        <button onClick={() => deleteMessage(msg.id)} className="hover:underline">
                          {t('chat.deleteMessage')}
                        </button>
                      )}
                      <span dir="ltr">{formatTime(msg.created_at, locale)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending attachments preview */}
      {pendingAttachments.length > 0 && (
        <div className="px-4 py-2 bg-white border-t border-gray-200">
          <div className="flex items-center gap-2 flex-wrap">
            {pendingAttachments.map((pa) => (
              <span
                key={pa.id}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${
                  pa.status === 'error' ? 'bg-red-50 text-red-700' :
                  pa.status === 'uploaded' ? 'bg-green-50 text-green-700' :
                  'bg-gray-100 text-gray-700'
                }`}
              >
                {pa.file.type.startsWith('audio/') ? <Mic className="w-3 h-3" /> : <Paperclip className="w-3 h-3" />}
                <span className="max-w-[150px] truncate">{pa.file.name}</span>
                <span className="text-[10px] opacity-70">{bytesToHuman(pa.file.size)}</span>
                {pa.status === 'uploading' && <span className="text-[10px]">…</span>}
                <button
                  onClick={() => removePending(pa.id)}
                  className="p-0.5 rounded hover:bg-black/10"
                  title="Remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 text-red-700 text-sm border-t border-red-200">
          {error}
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-gray-200 bg-white px-3 py-2">
        {recording ? (
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="flex items-center gap-2 text-red-600">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
              <span className="text-sm font-medium">{t('chat.recording')}</span>
            </span>
            <div className="flex-1" />
            <button
              onClick={cancelRecording}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
              title={t('common.cancel')}
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={stopRecording}
              className="p-2 rounded-full bg-red-600 text-white hover:bg-red-700"
              title={t('chat.stopRecording')}
            >
              <Square className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={onFilesPicked}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-600 flex-shrink-0"
              title={t('chat.attach')}
              disabled={pendingAttachments.length >= MAX_ATTACHMENTS_PER_MESSAGE}
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <button
              onClick={startRecording}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-600 flex-shrink-0"
              title={t('chat.voiceRecord')}
            >
              <Mic className="w-5 h-5" />
            </button>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t('chat.typePlaceholder')}
              dir="auto"
              rows={1}
              className="flex-1 resize-none px-3 py-2 rounded-2xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm max-h-32"
            />
            <button
              onClick={send}
              disabled={sending || (!body.trim() && pendingAttachments.filter((p) => p.status === 'uploaded').length === 0)}
              className="p-2 rounded-full bg-brand-600 text-white hover:bg-brand-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex-shrink-0"
              title={t('chat.send')}
            >
              <Send className="w-5 h-5 rtl:scale-x-[-1]" />
            </button>
          </div>
        )}
        <div className="px-2 mt-1 text-[10px] text-gray-400">
          {t('chat.filesLimit')}
        </div>
      </div>
    </div>
  );
}
