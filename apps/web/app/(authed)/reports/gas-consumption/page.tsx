import { requireScreen } from '@/lib/auth/require-screen';
import { ReportsRepository } from '@k3/repositories';
import { getTranslations } from 'next-intl/server';
import { ReportShell, fmtKwd, fmtInt, type ReportColumn } from '@/components/reports/report-shell';
import type { GasConsumptionRow } from '@k3/repositories';

export const dynamic = 'force-dynamic';

interface PageProps { searchParams: { from_date?: string; to_date?: string } }

function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(start), to: iso(now) };
}

export default async function GasConsumptionReportPage({ searchParams }: PageProps) {
  const ctx = await requireScreen('report_gas_consumption', 'view');
  const def = defaultRange();
  const from = searchParams.from_date ?? def.from;
  const to = searchParams.to_date ?? def.to;

  const repo = new ReportsRepository(ctx.supabase);
  const rows = await repo.gasConsumption(from, to);
  const t = await getTranslations();

  const totalQty = rows.reduce((s, r) => s + r.total_quantity, 0);
  const totalValue = rows.reduce((s, r) => s + r.total_value, 0);

  const columns: ReportColumn<GasConsumptionRow>[] = [
    { key: 'name', header: t('reports.gasConsumption.name'),
      cell: (r) => <span className="font-medium">{r.gas_name}</span>,
      csv: (r) => r.gas_name },
    { key: 'qty', header: t('reports.gasConsumption.totalQuantity'), align: 'end',
      cell: (r) => fmtInt(r.total_quantity), csv: (r) => r.total_quantity },
    { key: 'value', header: t('reports.gasConsumption.totalValue'), align: 'end',
      cell: (r) => fmtKwd(r.total_value), csv: (r) => r.total_value.toFixed(3) },
    { key: 'jobs', header: t('reports.gasConsumption.jobCount'), align: 'end', hideOnMobile: true,
      cell: (r) => fmtInt(r.job_count), csv: (r) => r.job_count },
  ];

  return (
    <ReportShell
      title={t('reports.gasConsumption.title')}
      rows={rows}
      columns={columns}
      hasDateRange
      fromDate={from}
      toDate={to}
      summaryRow={
        <tr>
          <td className="px-4 py-2.5">{t('common.total')}</td>
          <td className="px-4 py-2.5 text-end font-mono">{fmtInt(totalQty)}</td>
          <td className="px-4 py-2.5 text-end font-mono">{fmtKwd(totalValue)}</td>
          <td className="px-4 py-2.5 text-end hidden md:table-cell">—</td>
        </tr>
      }
    />
  );
}
