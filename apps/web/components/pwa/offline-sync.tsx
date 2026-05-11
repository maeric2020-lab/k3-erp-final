'use client';

/**
 * Sync manager — يستمع لحدث 'online' ويُعيد إرسال الإجراءات المعلَّقة.
 *
 * يُحقن في root layout كـ 'use client' component.
 * يستخدم navigator.onLine + window.addEventListener('online').
 *
 * كل إجراء له handler خاص يُرسل HTTP request مناسب.
 */

import { useEffect, useState } from 'react';
import { getPendingActions, removeAction, incrementActionAttempt, type PendingAction } from '@/lib/offline/db';
import { logger } from '@/lib/logger';
import { toast } from '@/lib/toast';

const MAX_ATTEMPTS = 5;

async function syncOne(action: PendingAction): Promise<boolean> {
  if (!action.id) return false;

  let url = '';
  let method = 'POST';
  let body: any = action.payload;

  switch (action.type) {
    case 'job_status_change':
      url = `/api/jobs/${action.jobId}/status`;
      method = 'POST';
      break;
    case 'job_arrived':
      url = `/api/jobs/${action.jobId}/arrive`;
      method = 'POST';
      break;
    case 'job_complete':
      url = `/api/jobs/${action.jobId}/complete`;
      method = 'POST';
      break;
    case 'job_signature':
      url = `/api/jobs/${action.jobId}/signature`;
      method = 'POST';
      break;
    default:
      logger.warn('sync.unknown_action_type', { type: action.type });
      return false;
  }

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        // Idempotency-Key لمنع تنفيذ مكرر إذا أُعيدت المزامنة
        'Idempotency-Key': `sync_${action.id}_${action.createdAt}`,
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      await removeAction(action.id);
      logger.info('sync.action_synced', { id: action.id, type: action.type });
      return true;
    }

    // 4xx = خطأ منطقي لا يستحق إعادة المحاولة (نحذفه)
    if (res.status >= 400 && res.status < 500) {
      await removeAction(action.id);
      logger.warn('sync.action_rejected', { id: action.id, type: action.type, status: res.status });
      return false;
    }

    // 5xx — إعادة المحاولة
    await incrementActionAttempt(action.id);
    if (action.attempts >= MAX_ATTEMPTS) {
      await removeAction(action.id);
      logger.error('sync.action_max_attempts', new Error(`exceeded ${MAX_ATTEMPTS} attempts`), {
        id: action.id,
        type: action.type,
      });
    }
    return false;
  } catch (err) {
    // network error — نُبقي الإجراء في الـ queue
    await incrementActionAttempt(action.id).catch(() => {});
    logger.warn('sync.network_error', { id: action.id, error: (err as Error).message });
    return false;
  }
}

async function syncAll() {
  const pending = await getPendingActions();
  if (pending.length === 0) return;

  logger.info('sync.start', { count: pending.length });
  let synced = 0;
  for (const action of pending) {
    const ok = await syncOne(action);
    if (ok) synced++;
  }
  logger.info('sync.complete', { synced, total: pending.length });

  if (synced > 0) {
    toast.success(`تم مزامنة ${synced} ${synced === 1 ? 'إجراء' : 'إجراءات'}`);
  }
}

export function OfflineSyncManager() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    function onOnline() {
      setOnline(true);
      toast.info('عاد الاتصال — يجري المزامنة');
      syncAll();
    }
    function onOffline() {
      setOnline(false);
      toast.warning('فقدت الاتصال — الإجراءات ستُحفظ ومزامنتها لاحقاً');
    }

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // مزامنة فورية عند التحميل إذا كان online
    if (navigator.onLine) {
      syncAll().catch((err) => logger.error('sync.initial_failed', err));
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // عرض شارة "غير متصل" في أعلى الشاشة عند فقد الاتصال
  if (online) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[200] bg-amber-500 text-white text-xs text-center py-1 font-medium">
      أنت تعمل بدون اتصال — الإجراءات ستُزامن عند عودة الإنترنت
    </div>
  );
}
