'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import type { Invoice } from '@k3/repositories';

type Enriched = Invoice & { customer_name: string };

interface Props {
  initialRows: Enriched[];
  total: number;
  canAdd: boolean;
  initialFilter: 'all' | 'outstanding';
}

const STATUS_CLS: Record<string, string> = {
  issued: 'bg-blue-50 text-blue-700',
  partial: 'bg-amber-50 text-amber-700',
  paid: 'bg-green-50 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
  void: 'bg-gray-100 text-gray-500',
};

export function InvoicesClient({ initialRows, total, initialFilter }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'outstanding'>(initialFilter);

  const filtered = search
    ? initialRows.filter((i) => i.invoice_no.toLowerCase().includes(search.toLowerCase()) || (i.customer_name ?? '').toLowerCase().includes(search.toLowerCase()))
    : initialRows;

  const setMode = (mode: 'all' | 'outstanding') => {
    setFilter(mode);
    if (mode === 'outstanding') router.push('/finance/invoices?status=outstanding');
    else router.push('/finance/invoices');
  };

  const columns: Column<Enriched>[] = [
    { key: 'invoice_no', header: t('finance.invoices.invoiceNo'), className: 'w-32',
      cell: (r) => <Link href={`/finance/invoices/${r.id}`} className="text-brand-600 hover:underline font-mono text-xs">{r.invoice_no}</Link> },
    { key: 'customer_name', header: t('operations.requests.customer'), cell: (r) => <span dir="auto">{r.customer_name}</span> },
    { key: 'issue_date', header: t('finance.invoices.issueDate'), hideOnMobile: true },
    { key: 'total_amount', header: t('common.total'), align: 'end',
      cell: (r) => <span className="font-mono">{Number(r.total_amount).toFixed(3)}</span> },
    { key: 'amount_paid', header: t('finance.invoices.amountPaid'), align: 'end', hideOnMobile: true,
      cell: (r) => <span className="font-mono">{Number(r.amount_paid).toFixed(3)}</span> },
    { key: 'balance', header: t('finance.invoices.balance'), align: 'end',
      cell: (r) => <span className="font-mono font-semibold">{Number(r.balance).toFixed(3)}</span> },
    { key: 'status', header: t('common.status'), align: 'center',
      cell: (r) => (
        <div className="flex items-center justify-center gap-1">
          <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_CLS[r.status] ?? ''}`}>
            {t(`finance.invoices.statuses.${r.status}` as any)}
          </span>
          {r.is_zero_charge && (
            <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px]">
              {t('finance.invoices.zeroCharge')}
            </span>
          )}
        </div>
      ) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">{t('finance.invoices.title')}</h1>
        <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-white p-1">
          <Button
            size="sm" variant={filter === 'all' ? 'default' : 'ghost'}
            onClick={() => setMode('all')}>{t('common.all') ?? 'All'}</Button>
          <Button
            size="sm" variant={filter === 'outstanding' ? 'default' : 'ghost'}
            onClick={() => setMode('outstanding')}>{t('finance.invoices.outstanding')}</Button>
        </div>
      </div>
      <DataTable
        rows={filtered} columns={columns} total={total}
        page={page} pageSize={50} onPageChange={setPage}
        onSearch={setSearch} searchValue={search}
      />
    </div>
  );
}
