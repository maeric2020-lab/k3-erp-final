'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import type { Quotation } from '@k3/repositories';

type Enriched = Quotation & { customer_name: string };

interface Props { initialRows: Enriched[]; total: number; canAdd: boolean }

const STATUS_CLS: Record<string, string> = {
  draft: 'bg-gray-50 text-gray-600',
  sent: 'bg-blue-50 text-blue-700',
  accepted: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
  expired: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export function QuotationsClient({ initialRows, total, canAdd }: Props) {
  const t = useTranslations();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const filtered = search
    ? initialRows.filter((q) => q.quotation_no.toLowerCase().includes(search.toLowerCase()) || (q.customer_name ?? '').toLowerCase().includes(search.toLowerCase()))
    : initialRows;

  const columns: Column<Enriched>[] = [
    { key: 'quotation_no', header: t('finance.quotations.quotationNo'), className: 'w-32 font-mono text-xs',
      cell: (r) => <Link href={`/sales/quotations/${r.id}`} className="text-brand-600 hover:underline font-mono">{r.quotation_no}</Link> },
    { key: 'customer_name', header: t('operations.requests.customer'), cell: (r) => <span dir="auto">{r.customer_name}</span> },
    { key: 'request_type', header: t('operations.requests.requestType'), align: 'center', hideOnMobile: true },
    { key: 'issue_date', header: t('finance.quotations.issueDate'), hideOnMobile: true },
    { key: 'valid_until', header: t('finance.quotations.validUntil'), hideOnMobile: true,
      cell: (r) => r.valid_until ?? '—' },
    { key: 'total_amount', header: t('common.total'), align: 'end',
      cell: (r) => <span className="font-mono">{Number(r.total_amount).toFixed(3)}</span> },
    { key: 'status', header: t('common.status'), align: 'center',
      cell: (r) => (
        <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_CLS[r.status] ?? ''}`}>
          {t(`finance.quotations.statuses.${r.status}` as any)}
        </span>
      ) },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('finance.quotations.title')}</h1>
      <DataTable
        rows={filtered} columns={columns} total={total}
        page={page} pageSize={50} onPageChange={setPage}
        onSearch={setSearch} searchValue={search}
        rightAction={canAdd && (
          <Link href="/sales/quotations/new">
            <Button><Plus className="w-4 h-4 me-1" />{t('finance.quotations.newQuotation')}</Button>
          </Link>
        )}
      />
    </div>
  );
}
