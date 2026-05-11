import { requireScreen } from '@/lib/auth/require-screen';
import { ReportsRepository } from '@k3/repositories';
import { getTranslations } from 'next-intl/server';
import { ReportShell, fmtKwd, fmtInt, type ReportColumn } from '@/components/reports/report-shell';
import type { TechnicianPerfRow } from '@k3/repositories';

export const dynamic = 'force-dynamic';

interface PageProps { searchParams: { from_date?: string; to_date?: string } }

function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(start), to: iso(now) };
}

export default async function TechnicianPerfReportPage({ searchParams }: PageProps) {
  const ctx = await requireScreen('report_technician_perf', 'view');
  const def = defaultRange();
  const from = searchParams.from_date ?? def.from;
  const to = searchParams.to_date ?? def.to;

  const repo = new ReportsRepository(ctx.supabase);
  const rows = await repo.technicianPerf(from, to);
  const t = await getTranslations();

  const totalCompleted = rows.reduce((s, r) => s + r.jobs_completed, 0);
  const totalCancelled = rows.reduce((s, r) => s + r.jobs_cancelled, 0);
  const totalInvoiced = rows.reduce((s, r) => s + r.total_invoiced, 0);

  const fmtMin = (m: number | null) => m == null ? '—' : `${Math.round(m)} min`;

  const columns: ReportColumn<TechnicianPerfRow>[] = [
    { key: 'name', header: t('reports.technicianPerf.name'),
      cell: (r) => <span dir="auto">{r.technician_name}</span>,
      csv: (r) => r.technician_name },
    { key: 'code', header: t('reports.technicianPerf.code'), hideOnMobile: true,
      cell: (r) => r.technician_code ? <span className="font-mono text-xs">{r.technician_code}</span> : '—',
      csv: (r) => r.technician_code ?? '' },
    { key: 'completed', header: t('reports.technicianPerf.completed'), align: 'end',
      cell: (r) => <span className="text-green-700 font-medium">{fmtInt(r.jobs_completed)}</span>,
      csv: (r) => r.jobs_completed },
    { key: 'cancelled', header: t('reports.technicianPerf.cancelled'), align: 'end', hideOnMobile: true,
      cell: (r) => r.jobs_cancelled > 0 ? <span className="text-red-600">{fmtInt(r.jobs_cancelled)}</span> : '—',
      csv: (r) => r.jobs_cancelled },
    { key: 'avg_time', header: t('reports.technicianPerf.avgMinutes'), align: 'end', hideOnMobile: true,
      cell: (r) => fmtMin(r.avg_minutes_arrival_to_complete),
      csv: (r) => r.avg_minutes_arrival_to_complete == null ? '' : Math.round(r.avg_minutes_arrival_to_complete) },
    { key: 'invoiced', header: t('reports.technicianPerf.totalInvoiced'), align: 'end',
      cell: (r) => fmtKwd(r.total_invoiced), csv: (r) => r.total_invoiced.toFixed(3) },
  ];

  return (
    <ReportShell
      title={t('reports.technicianPerf.title')}
      rows={rows}
      columns={columns}
      hasDateRange
      fromDate={from}
      toDate={to}
      summaryRow={
        <tr>
          <td className="px-4 py-2.5" colSpan={2}>{t('common.total')}</td>
          <td className="px-4 py-2.5 text-end font-mono text-green-700">{fmtInt(totalCompleted)}</td>
          <td className="px-4 py-2.5 text-end font-mono hidden md:table-cell">{fmtInt(totalCancelled)}</td>
          <td className="px-4 py-2.5 text-end hidden md:table-cell">—</td>
          <td className="px-4 py-2.5 text-end font-mono">{fmtKwd(totalInvoiced)}</td>
        </tr>
      }
    />
  );
}
