import { requireScreen } from '@/lib/auth/require-screen';
import { ReportsRepository } from '@k3/repositories';
import { getTranslations } from 'next-intl/server';
import { ReportShell, fmtKwd, fmtInt, type ReportColumn } from '@/components/reports/report-shell';
import Link from 'next/link';
import type { ActiveContractRow } from '@k3/repositories';

export const dynamic = 'force-dynamic';

export default async function ActiveContractsReportPage() {
  const ctx = await requireScreen('report_active_contracts', 'view');
  const repo = new ReportsRepository(ctx.supabase);
  const rows = await repo.activeContracts();
  const t = await getTranslations();

  const totalAmount = rows.reduce((s, r) => s + r.total_amount, 0);
  const totalMachines = rows.reduce((s, r) => s + r.machine_count, 0);

  const columns: ReportColumn<ActiveContractRow>[] = [
    { key: 'no', header: t('reports.activeContracts.contractNo'),
      cell: (r) => (
        <Link href={`/contracts/${r.contract_id}`} className="text-brand-600 hover:underline font-mono text-sm">
          {r.contract_no}
        </Link>
      ),
      csv: (r) => r.contract_no },
    { key: 'type', header: t('reports.activeContracts.type'), hideOnMobile: true,
      cell: (r) => (
        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
          {r.contract_type}{r.is_4_year ? ' / 4Y' : ''}
        </span>
      ),
      csv: (r) => `${r.contract_type}${r.is_4_year ? ' / 4Y' : ''}` },
    { key: 'customer', header: t('reports.activeContracts.customer'),
      cell: (r) => <span dir="auto">{r.customer_name}</span>,
      csv: (r) => r.customer_name },
    { key: 'start', header: t('reports.activeContracts.startDate'), hideOnMobile: true,
      cell: (r) => new Date(r.start_date).toLocaleDateString(), csv: (r) => r.start_date },
    { key: 'end', header: t('reports.activeContracts.endDate'),
      cell: (r) => new Date(r.end_date).toLocaleDateString(), csv: (r) => r.end_date },
    { key: 'days', header: t('reports.activeContracts.daysRemaining'), align: 'end',
      cell: (r) => (
        <span className={r.days_remaining < 30 ? 'text-red-700 font-semibold' : r.days_remaining < 90 ? 'text-amber-700' : ''}>
          {fmtInt(r.days_remaining)}
        </span>
      ),
      csv: (r) => r.days_remaining },
    { key: 'machines', header: t('reports.activeContracts.machineCount'), align: 'end', hideOnMobile: true,
      cell: (r) => fmtInt(r.machine_count), csv: (r) => r.machine_count },
    { key: 'amount', header: t('reports.activeContracts.totalAmount'), align: 'end',
      cell: (r) => fmtKwd(r.total_amount), csv: (r) => r.total_amount.toFixed(3) },
  ];

  return (
    <ReportShell
      title={t('reports.activeContracts.title')}
      rows={rows}
      columns={columns}
      isSnapshot
      summaryRow={
        <tr>
          <td className="px-4 py-2.5" colSpan={2}>{t('common.total')}</td>
          <td className="px-4 py-2.5 hidden md:table-cell">—</td>
          <td className="px-4 py-2.5 hidden md:table-cell">—</td>
          <td className="px-4 py-2.5">—</td>
          <td className="px-4 py-2.5 text-end">—</td>
          <td className="px-4 py-2.5 text-end font-mono hidden md:table-cell">{fmtInt(totalMachines)}</td>
          <td className="px-4 py-2.5 text-end font-mono">{fmtKwd(totalAmount)}</td>
        </tr>
      }
    />
  );
}
