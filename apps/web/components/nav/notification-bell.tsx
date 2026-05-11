'use client';

/**
 * NotificationBell — جرس الإشعارات في الـ topbar.
 *
 * يفعل:
 *   - يجلب آخر 20 إشعار + عدد غير المقروء
 *   - يشترك على Realtime للإشعارات الجديدة
 *   - يعرض dropdown عند النقر
 *   - يعلّم الإشعار كمقروء عند النقر عليه
 *   - زر "تعليم الكل كمقروء"
 */

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { toast } from '@/lib/toast';
import { logger } from '@/lib/logger';

interface Notification {
  id: string;
  type: string;
  title_ar: string;
  title_en: string;
  body_ar: string | null;
  body_en: string | null;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
}

export function NotificationBell({ userId, locale }: { userId: string; locale: 'ar' | 'en' }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // الجلب الأوّل
  useEffect(() => {
    let cancelled = false;
    fetch('/api/notifications?limit=20')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setItems(data.rows ?? []);
        setUnread(data.unread ?? 0);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        logger.error('notifications.fetch_failed', err);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Realtime subscription
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`notif:${userId}`)
      .on(
        // الصيغة الصحيحة لـ supabase-js 2.43+
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newItem = payload.new as Notification;
          setItems((prev) => [newItem, ...prev].slice(0, 20));
          setUnread((u) => u + 1);
          // toast صغير لتنبيه المستخدم
          toast.info(locale === 'ar' ? newItem.title_ar : newItem.title_en);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, locale]);

  // إغلاق الـ dropdown عند النقر خارجه
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function markRead(id: string) {
    try {
      await fetch(`/api/notifications/${id}/mark-read`, { method: 'POST' });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
      setUnread((u) => Math.max(0, u - 1));
    } catch (err) {
      logger.error('notifications.mark_read_failed', err as Error);
    }
  }

  async function markAllRead() {
    try {
      const res = await fetch('/api/notifications/mark-all-read', { method: 'POST' });
      const data = await res.json();
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
      setUnread(0);
      toast.success(locale === 'ar' ? `عُلِّم ${data.marked} إشعار كمقروء` : `Marked ${data.marked} as read`);
    } catch (err) {
      logger.error('notifications.mark_all_failed', err as Error);
      toast.error(locale === 'ar' ? 'فشل التعليم كمقروء' : 'Failed to mark as read');
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-md hover:bg-gray-100 transition-colors"
        aria-label={locale === 'ar' ? 'الإشعارات' : 'Notifications'}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute top-0 end-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full translate-x-1/3 -translate-y-1/3 rtl:-translate-x-1/3">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-2 end-0 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-lg border shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="font-semibold">
              {locale === 'ar' ? 'الإشعارات' : 'Notifications'}
            </h3>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                <CheckCheck size={14} />
                {locale === 'ar' ? 'تعليم الكل' : 'Mark all'}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-gray-500">
                {locale === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                {locale === 'ar' ? 'لا توجد إشعارات' : 'No notifications yet'}
              </div>
            ) : (
              items.map((n) => (
                <NotificationItem
                  key={n.id}
                  notif={n}
                  locale={locale}
                  onClick={() => {
                    if (!n.read_at) markRead(n.id);
                    setOpen(false);
                  }}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationItem({
  notif,
  locale,
  onClick,
}: {
  notif: Notification;
  locale: 'ar' | 'en';
  onClick: () => void;
}) {
  const title = locale === 'ar' ? notif.title_ar : notif.title_en;
  const body = locale === 'ar' ? notif.body_ar : notif.body_en;
  const isUnread = !notif.read_at;

  const content = (
    <div
      onClick={onClick}
      className={`block p-3 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 ${isUnread ? 'bg-blue-50/50' : ''}`}
    >
      <div className="flex items-start gap-2">
        {isUnread && <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{title}</div>
          {body && <div className="text-xs text-gray-600 mt-0.5">{body}</div>}
          <div className="text-[10px] text-gray-400 mt-1">
            {new Date(notif.created_at).toLocaleString(locale === 'ar' ? 'ar-KW' : 'en-US')}
          </div>
        </div>
      </div>
    </div>
  );

  if (notif.action_url) {
    return <Link href={notif.action_url}>{content}</Link>;
  }
  return content;
}
