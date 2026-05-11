'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Job } from '@k3/repositories';

type EnrichedJob = Job & { customer_name: string; technician_name: string | null };

interface Props {
  initialRows: EnrichedJob[];
  canEdit: boolean;
}

const COLUMNS = [
  { key: 'queued',     statuses: ['assigned'],                                          color: 'bg-blue-50 border-blue-200' },
  { key: 'in_field',   statuses: ['accepted','on_way','arrived','inspection_started'], color: 'bg-amber-50 border-amber-200' },
  { key: 'working',    statuses: ['work_started','report_pending'],                    color: 'bg-orange-50 border-orange-200' },
  { key: 'completed',  statuses: ['completed','invoiced'],                              color: 'bg-green-50 border-green-200' },
  { key: 'closed',     statuses: ['closed','cancelled'],                                color: 'bg-gray-50 border-gray-200' },
] as const;

const COLUMN_LABELS: Record<string, { ar: string; en: string }> = {
  queued:    { ar: 'الطابور',       en: 'Queue' },
  in_field:  { ar: 'في الميدان',     en: 'In field' },
  working:   { ar: 'قيد العمل',      en: 'Working' },
  completed: { ar: 'مكتملة',         en: 'Completed' },
  closed:    { ar: 'مغلقة/ملغاة',    en: 'Closed/Cancelled' },
};

export function JobsBoardClient({ initialRows }: Props) {
  const t = useTranslations();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return initialRows;
    const q = search.toLowerCase();
    return initialRows.filter((j) =>
      j.job_no.toLowerCase().includes(q) ||
      (j.customer_name ?? '').toLowerCase().includes(q) ||
      (j.technician_name ?? '').toLowerCase().includes(q)
    );
  }, [initialRows, search]);

  const grouped = useMemo(() => {
    const out: Record<string, EnrichedJob[]> = {};
    for (const col of COLUMNS) out[col.key] = [];
    for (const j of filtered) {
      for (const col of COLUMNS) {
        if ((col.statuses as readonly string[]).includes(j.status)) {
          out[col.key].push(j);
          break;
        }
      }
    }
    return out;
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{t('operations.jobs.dispatch')}</h1>
        <div className="relative max-w-xs flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-gray-400 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.search')}
            className="ps-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {COLUMNS.map((col) => {
          const list = grouped[col.key] ?? [];
          return (
            <div key={col.key} className={`rounded-lg border ${col.color} p-2`}>
              <div className="flex items-center justify-between px-1 pb-2 border-b border-gray-200/70">
                <span className="font-semibold text-sm">
                  {COLUMN_LABELS[col.key].ar} / {COLUMN_LABELS[col.key].en}
                </span>
                <span className="text-xs text-gray-600 bg-white/70 rounded-full px-2 py-0.5">{list.length}</span>
              </div>
              <div className="space-y-1.5 mt-2 max-h-[70vh] overflow-y-auto pe-1">
                {list.map((job) => (
                  <Link
                    key={job.id}
                    href={`/operations/jobs/${job.id}`}
                    className="block bg-white rounded-md border border-gray-200 p-2.5 text-xs hover:shadow-sm transition-shadow"
                  >
                    <div className="font-mono text-[11px] text-gray-500">{job.job_no}</div>
                    <div className="font-semibold truncate" dir="auto">{job.customer_name}</div>
                    <div className="flex items-center justify-between mt-1 text-[11px]">
                      <span className="text-gray-500 truncate">
                        {job.technician_name ?? '—'}
                      </span>
                      <span className="font-mono">{job.request_type}</span>
                    </div>
                    <div className="mt-1 text-[10px] text-gray-500">
                      {t(`operations.jobs.statuses.${job.status}` as any)}
                    </div>
                  </Link>
                ))}
                {list.length === 0 && <div className="text-center py-4 text-xs text-gray-400">—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
