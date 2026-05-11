'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { DataTable, type Column } from '@/components/ui/data-table';
import type { Payment } from '@k3/repositories';

type Enriched = Payment & { customer_name: string; invoice_no: string };

interface Props { initialRows: Enriched[]; total: number }

export function PaymentsClient({ initialRows, total }: Props) {
  const t = useTranslations();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = search
    ? initialRows.filter((p) => p.payment_no.toLowerCase().includes(search.toLowerCase()) ||
                               p.invoice_no.toLowerCase().includes(search.toLowerCase()) ||
                               (p.customer_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
                               (p.reference ?? '').toLowerCase().includes(search.toLowerCase()))
    : initialRows;

  const columns: Column<Enriched>[] = [
    { key: 'payment_no', header: t('finance.payments.paymentNo'), className: 'w-32',
      cell: (r) => <span className="font-mono text-xs">{r.payment_no}</span> },
    { key: 'invoice_no', header: t('finance.invoices.invoiceNo'), className: 'w-32',
      cell: (r) => <Link href={`/finance/invoices/${r.invoice_id}`} className="text-brand-600 hover:underline font-mono text-xs">{r.invoice_no}</Link> },
    { key: 'customer_name', header: t('operations.requests.customer'), cell: (r) => <span dir="auto">{r.customer_name}</span> },
    { key: 'payment_date', header: t('finance.payments.paymentDate'), hideOnMobile: true },
    { key: 'method', header: t('finance.payments.method'), align: 'center',
      cell: (r) => <span className="text-xs">{t(`finance.payments.methods.${r.method}` as any)}</span> },
    { key: 'reference', header: t('finance.payments.reference'), hideOnMobile: true,
      cell: (r) => r.reference ?? '—' },
    { key: 'amount', header: t('finance.payments.amount'), align: 'end',
      cell: (r) => <span className="font-mono">{Number(r.amount).toFixed(3)}</span> },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('finance.payments.title')}</h1>
      <DataTable
        rows={filtered} columns={columns} total={total}
        page={page} pageSize={50} onPageChange={setPage}
        onSearch={setSearch} searchValue={search}
      />
    </div>
  );
}
