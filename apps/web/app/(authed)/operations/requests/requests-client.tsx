'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import type { MaintenanceRequest } from '@k3/repositories';

type EnrichedRequest = MaintenanceRequest & { customer_name: string };

interface Props {
  initialRows: EnrichedRequest[];
  initialTotal: number;
  canAdd: boolean;
  canEdit: boolean;
}

export function RequestsClient({ initialRows, initialTotal, canAdd, canEdit }: Props) {
  const t = useTranslations();
  const [rows] = useState(initialRows);

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      open: 'bg-blue-50 text-blue-700',
      in_progress: 'bg-amber-50 text-amber-700',
      closed: 'bg-green-50 text-green-700',
      cancelled: 'bg-gray-100 text-gray-500',
    };
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${styles[status] ?? 'bg-gray-50 text-gray-600'}`}>
        {t(`operations.requests.statuses.${status}` as any)}
      </span>
    );
  };

  const priorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      low: 'bg-gray-50 text-gray-500',
      normal: 'bg-blue-50 text-blue-700',
      high: 'bg-amber-50 text-amber-700',
      urgent: 'bg-red-50 text-red-700',
    };
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${styles[priority] ?? ''}`}>
        {t(`operations.requests.priorities.${priority}` as any)}
      </span>
    );
  };

  const columns: Column<EnrichedRequest>[] = [
    {
      key: 'request_no',
      header: t('operations.requests.requestNo'),
      className: 'font-mono text-xs w-28',
      cell: (r) => (
        <Link href={`/operations/requests/${r.id}`} className="text-brand-600 hover:underline font-medium">
          {r.request_no}
        </Link>
      ),
    },
    { key: 'customer_name', header: t('operations.requests.customer'), cell: (r) => <span className="font-medium">{r.customer_name}</span> },
    {
      key: 'request_type',
      header: t('operations.requests.requestType'),
      hideOnMobile: true,
      cell: (r) => (
        <span className="inline-block px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 text-xs font-mono">
          {r.request_type}
        </span>
      ),
    },
    {
      key: 'problem_code',
      header: t('operations.requests.problem'),
      hideOnMobile: true,
      cell: (r) => t(`operations.requests.problemCodes.${r.problem_code}` as any),
    },
    { key: 'priority', header: t('operations.requests.priority'), align: 'center', cell: (r) => priorityBadge(r.priority) },
    { key: 'status', header: t('common.status'), align: 'center', cell: (r) => statusBadge(r.status) },
    {
      key: 'created_at',
      header: t('common.createdAt'),
      hideOnMobile: true,
      cell: (r) => <span className="text-xs text-gray-600">{new Date(r.created_at).toLocaleDateString()}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('operations.requests.title')}</h1>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        total={initialTotal}
        page={1}
        pageSize={50}
        rightAction={
          canAdd && (
            <Link href="/operations/requests/new">
              <Button>
                <Plus className="w-4 h-4 me-1" />
                {t('operations.requests.newRequest')}
              </Button>
            </Link>
          )
        }
      />
    </div>
  );
}
