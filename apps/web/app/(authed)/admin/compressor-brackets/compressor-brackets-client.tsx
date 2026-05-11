'use client';

import { useTranslations } from 'next-intl';
import { SimpleMasterClient } from '@/components/masters/simple-master-client';
import type { Column } from '@/components/ui/data-table';
import type { CompressorBracket } from '@k3/repositories';

interface Props {
  initialRows: CompressorBracket[];
  total: number;
  canAdd: boolean;
  canEdit: boolean;
}

export function CompressorBracketsClient({ initialRows, total, canAdd, canEdit }: Props) {
  const t = useTranslations();

  const columns: Column<CompressorBracket>[] = [
    { key: 'hp_min', header: t('finance.compressorBrackets.hpMin'), align: 'end',
      cell: (r) => <span className="font-mono">{Number(r.hp_min).toFixed(1)}</span> },
    { key: 'hp_max', header: t('finance.compressorBrackets.hpMax'), align: 'end',
      cell: (r) => <span className="font-mono">{Number(r.hp_max).toFixed(1)}</span> },
    { key: 'base_price', header: t('finance.compressorBrackets.basePrice'), align: 'end',
      cell: (r) => <span className="font-mono">{Number(r.base_price).toFixed(3)} KWD</span> },
    { key: 'k3_supplied_surcharge_pct', header: t('finance.compressorBrackets.k3Surcharge'), align: 'end',
      cell: (r) => <span className="font-mono">{Number(r.k3_supplied_surcharge_pct).toFixed(1)}%</span> },
    { key: 'is_active', header: t('common.status'), align: 'center',
      cell: (r) => (
        <span className={`px-2 py-0.5 rounded-full text-xs ${r.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {r.is_active ? t('common.active') : t('common.inactive')}
        </span>
      ) },
  ];

  return (
    <SimpleMasterClient<CompressorBracket>
      title={t('finance.compressorBrackets.title')}
      rows={initialRows}
      total={total}
      columns={columns}
      apiPath="/api/admin/compressor-brackets"
      canAdd={canAdd}
      canEdit={canEdit}
      fields={[
        { name: 'hp_min', label: t('finance.compressorBrackets.hpMin'), required: true, type: 'number', dir: 'ltr' },
        { name: 'hp_max', label: t('finance.compressorBrackets.hpMax'), required: true, type: 'number', dir: 'ltr' },
        { name: 'base_price', label: t('finance.compressorBrackets.basePrice'), required: true, type: 'number', dir: 'ltr', placeholder: '70.000' },
        { name: 'k3_supplied_surcharge_pct', label: t('finance.compressorBrackets.k3Surcharge'), type: 'number', dir: 'ltr', placeholder: '10' },
        { name: 'is_active', label: t('common.status'), type: 'switch' },
      ]}
      defaultValues={{ hp_min: 0, hp_max: 0, base_price: 0, k3_supplied_surcharge_pct: 10, is_active: true }}
    />
  );
}
