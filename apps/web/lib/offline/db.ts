/**
 * IndexedDB wrapper بسيط للـ offline support.
 *
 * يوفّر:
 *   1. cacheJobs(jobs)              — حفظ وظائف الفنّي للوصول offline
 *   2. getCachedJobs()              — قراءة الوظائف المحفوظة
 *   3. enqueueAction(type, payload) — حفظ إجراء (تغيير حالة، توقيع) للمزامنة لاحقاً
 *   4. getPendingActions()          — قائمة الإجراءات المعلَّقة
 *   5. removeAction(id)             — حذف إجراء بعد نجاح المزامنة
 *
 * مكتوب بدون مكتبات (idb / dexie) لتقليل bundle size.
 */

const DB_NAME = 'k3-offline';
const DB_VERSION = 1;
const STORE_JOBS = 'jobs';
const STORE_ACTIONS = 'pending_actions';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB غير متوفر'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_JOBS)) {
        db.createObjectStore(STORE_JOBS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_ACTIONS)) {
        const store = db.createObjectStore(STORE_ACTIONS, { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | T): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const result = fn(store);
        if (result instanceof IDBRequest) {
          result.onsuccess = () => resolve(result.result);
          result.onerror = () => reject(result.error);
        } else {
          transaction.oncomplete = () => resolve(result);
          transaction.onerror = () => reject(transaction.error);
        }
      })
  );
}

// -----------------------------------------------------------------------------
// Jobs cache
// -----------------------------------------------------------------------------

export interface CachedJob {
  id: string;
  job_no?: string;
  customer_name?: string;
  status: string;
  problem_code?: string | null;
  cached_at: number;
  data: Record<string, any>;  // الـ row الكامل
}

export async function cacheJobs(jobs: CachedJob[]): Promise<void> {
  if (jobs.length === 0) return;
  await tx(STORE_JOBS, 'readwrite', (store) => {
    jobs.forEach((j) => store.put({ ...j, cached_at: Date.now() }));
    return store.transaction;
  });
}

export async function getCachedJobs(): Promise<CachedJob[]> {
  return new Promise((resolve, reject) => {
    openDb()
      .then((db) => {
        const transaction = db.transaction(STORE_JOBS, 'readonly');
        const store = transaction.objectStore(STORE_JOBS);
        const req = store.getAll();
        req.onsuccess = () => resolve((req.result as CachedJob[]) ?? []);
        req.onerror = () => reject(req.error);
      })
      .catch(reject);
  });
}

export async function clearCachedJobs(): Promise<void> {
  await tx(STORE_JOBS, 'readwrite', (store) => store.clear());
}

// -----------------------------------------------------------------------------
// Action queue (للإجراءات أثناء offline)
// -----------------------------------------------------------------------------

export interface PendingAction {
  id?: number;
  type: 'job_status_change' | 'job_signature' | 'job_arrived' | 'job_complete';
  jobId: string;
  payload: Record<string, any>;
  createdAt: number;
  attempts: number;
}

export async function enqueueAction(action: Omit<PendingAction, 'id' | 'createdAt' | 'attempts'>): Promise<number> {
  return tx(STORE_ACTIONS, 'readwrite', (store) => {
    const full: Omit<PendingAction, 'id'> = {
      ...action,
      createdAt: Date.now(),
      attempts: 0,
    };
    return store.add(full as any) as IDBRequest<number>;
  });
}

export async function getPendingActions(): Promise<PendingAction[]> {
  return new Promise((resolve, reject) => {
    openDb()
      .then((db) => {
        const transaction = db.transaction(STORE_ACTIONS, 'readonly');
        const store = transaction.objectStore(STORE_ACTIONS);
        const idx = store.index('createdAt');
        const req = idx.getAll();
        req.onsuccess = () => resolve((req.result as PendingAction[]) ?? []);
        req.onerror = () => reject(req.error);
      })
      .catch(reject);
  });
}

export async function removeAction(id: number): Promise<void> {
  await tx(STORE_ACTIONS, 'readwrite', (store) => store.delete(id));
}

export async function incrementActionAttempt(id: number): Promise<void> {
  return tx(STORE_ACTIONS, 'readwrite', (store) => {
    return new Promise<void>((resolve, reject) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const record = getReq.result as PendingAction | undefined;
        if (!record) {
          resolve();
          return;
        }
        record.attempts = (record.attempts ?? 0) + 1;
        const putReq = store.put(record);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    }) as any;
  });
}
