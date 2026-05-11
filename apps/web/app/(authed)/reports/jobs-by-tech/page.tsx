import { requireScreen } from '@/lib/auth/require-screen';
import { ReportsRepository } from '@k3/repositories';
import { getTranslations } from 'next-intl/server';
import { ReportShell, fmtInt, type ReportColumn } from '@/components/reports/report-shell';
import type { JobsByTechRow } from '@k3/repositories';

export const dynamic = 'force-dynamic';

export default async function JobsByTechReportPage() {
  const ctx = await requireScreen('report_jobs_by_tech', 'view');
  const repo = new ReportsRepository(ctx.supabase);
  const rows = await repo.jobsByTech();
  const t = await getTranslations();

  const columns: ReportColumn<JobsByTechRow>[] = [
    { key: 'name', header: t('reports.jobsByTech.technician'),
      cell: (r) => <span dir="auto">{r.technician_name}</span>,
      csv: (r) => r.technician_name },
    { key: 'status', header: t('reports.jobsByTech.status'),
      cell: (r) => <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-brand-50 text-brand-700">{r.status}</span>,
      csv: (r) => r.status },
    { key: 'count', header: t('reports.jobsByTech.count'), align: 'end',
      cell: (r) => fmtInt(r.count), csv: (r) => r.count },
  ];

  return (
    <ReportShell
      title={t('reports.jobsByTech.title')}
      rows={rows}
      columns={columns}
      isSnapshot
    />
  );
}
