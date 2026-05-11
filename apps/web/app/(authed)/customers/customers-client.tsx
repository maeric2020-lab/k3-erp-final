'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Pencil } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import type { Customer } from '@k3/repositories';

interface Props {
  initialRows: Customer[];
  initialTotal: number;
  canAdd: boolean;
  canEdit: boolean;
}

export function CustomersClient({ initialRows, initialTotal, canAdd, canEdit }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [rows] = useState(initialRows);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [, startTransition] = useTransition();

  const onSearch = (q: string) => {
    setSearch(q);
    setPage(1);
    startTransition(() => {
      router.push(`/customers?q=${encodeURIComponent(q)}`);
    });
  };

  const columns: Column<Customer>[] = [
    { key: 'code', header: t('customers.code'), className: 'w-32 font-mono text-xs' },
    { key: 'name_ar', header: t('common.name_ar'), cell: (r) => <span className="font-medium">{r.name_ar}</span> },
    { key: 'name_en', header: t('common.name_en'), hideOnMobile: true, cell: (r) => r.name_en ?? '—' },
    {
      key: 'customer_type',
      header: t('customers.type'),
      hideOnMobile: true,
      cell: (r) => t(`customers.types.${r.customer_type}` as any),
    },
    { key: 'phone_primary', header: t('customers.phonePrimary'), hideOnMobile: true, cell: (r) => r.phone_primary ?? '—' },
    {
      key: 'is_active',
      header: t('common.status'),
      align: 'center',
      cell: (r) =>
        r.is_active ? (
          <span className="inline-block px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs">{t('common.active')}</span>
        ) : (
          <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">{t('common.inactive')}</span>
        ),
    },
    {
      key: '__actions',
      header: '',
      align: 'end',
      cell: (r) =>
        canEdit ? (
          <Link
            href={`/customers/${r.id}`}
            className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 text-sm"
          >
            <Pencil className="w-3.5 h-3.5" />
            {t('common.edit')}
          </Link>
        ) : (
          <Link
            href={`/customers/${r.id}`}
            className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-800 text-sm"
          >
            {t('common.view')}
          </Link>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('customers.title')}</h1>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        total={initialTotal}
        page={page}
        pageSize={25}
        onPageChange={setPage}
        onSearch={onSearch}
        searchValue={search}
        searchPlaceholder={t('common.search')}
        rightAction={
          canAdd && (
            <Link href="/customers/new">
              <Button>
                <Plus className="w-4 h-4 me-1" />
                {t('customers.newCustomer')}
              </Button>
            </Link>
          )
        }
      />
    </div>
  );
}
