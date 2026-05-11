'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import type { Contract } from '@k3/repositories';

type EnrichedContract = Contract & { customer_name: string };

interface Props {
  initialRows: EnrichedContract[];
  total: number;
  canAdd: boolean;
}

export function ContractsClient({ initialRows, total, canAdd }: Props) {
  const t = useTranslations();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const filtered = search
    ? initialRows.filter((c) =>
        c.contract_no.toLowerCase().includes(search.toLowerCase()) ||
        (c.customer_name ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : initialRows;

  const STATUS_CLASSES: Record<string, string> = {
    draft: 'bg-gray-50 text-gray-600',
    active: 'bg-green-50 text-green-700',
    expired: 'bg-amber-50 text-amber-700',
    cancelled: 'bg-red-50 text-red-700',
    terminated: 'bg-red-50 text-red-700',
  };

  const columns: Column<EnrichedContract>[] = [
    { key: 'contract_no', header: t('operations.contracts.contractNo'), className: 'w-32 font-mono text-xs',
      cell: (r) => <Link href={`/contracts/${r.id}`} className="text-brand-600 hover:underline font-mono">{r.contract_no}</Link> },
    { key: 'customer_name', header: t('operations.requests.customer'),
      cell: (r) => <span dir="auto">{r.customer_name}</span> },
    { key: 'contract_type', header: t('operations.contracts.type'), align: 'center',
      cell: (r) => <span className="font-mono">{r.contract_type}{r.is_4_year ? 'G' : ''}</span> },
    { key: 'start_date', header: t('operations.contracts.startDate'), hideOnMobile: true },
    { key: 'end_date',   header: t('operations.contracts.endDate'),   hideOnMobile: true },
    { key: 'total_amount', header: t('operations.jobs.totalAmount'), align: 'end',
      cell: (r) => <span className="font-mono">{Number(r.total_amount).toFixed(3)}</span> },
    { key: 'status', header: t('common.status'), align: 'center',
      cell: (r) => (
        <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_CLASSES[r.status] ?? ''}`}>
          {t(`operations.contracts.statuses.${r.status}` as any)}
        </span>
      ) },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('operations.contracts.title')}</h1>
      <DataTable
        rows={filtered}
        columns={columns}
        total={total}
        page={page}
        pageSize={50}
        onPageChange={setPage}
        onSearch={setSearch}
        searchValue={search}
        searchPlaceholder={t('common.search')}
        rightAction={canAdd && (
          <Link href="/contracts/new">
            <Button><Plus className="w-4 h-4 me-1" />{t('operations.contracts.newContract')}</Button>
          </Link>
        )}
      />
    </div>
  );
}
