import { requireScreen } from '@/lib/auth/require-screen';
import { ReportsRepository } from '@k3/repositories';
import { getTranslations } from 'next-intl/server';
import { ReportShell, fmtKwd, fmtInt, type ReportColumn } from '@/components/reports/report-shell';
import type { SalesReportRow } from '@k3/repositories';

export const dynamic = 'force-dynamic';

interface PageProps { searchParams: { from_date?: string; to_date?: string } }

function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(start), to: iso(now) };
}

export default async function SalesReportPage({ searchParams }: PageProps) {
  const ctx = await requireScreen('report_sales', 'view');
  const def = defaultRange();
  const from = searchParams.from_date ?? def.from;
  const to = searchParams.to_date ?? def.to;

  const repo = new ReportsRepository(ctx.supabase);
  const rows = await repo.sales(from, to);
  const t = await getTranslations();

  const totalInvoices = rows.reduce((s, r) => s + r.invoice_count, 0);
  const totalInvoiced = rows.reduce((s, r) => s + r.invoiced_total, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid_total, 0);
  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding_total, 0);

  const columns: ReportColumn<SalesReportRow>[] = [
    { key: 'day', header: t('reports.sales.day'),
      cell: (r) => new Date(r.day).toLocaleDateString(),
      csv: (r) => r.day },
    { key: 'invoice_count', header: t('reports.sales.invoiceCount'), align: 'end',
      cell: (r) => fmtInt(r.invoice_count), csv: (r) => r.invoice_count },
    { key: 'invoiced_total', header: t('reports.sales.invoicedTotal'), align: 'end',
      cell: (r) => fmtKwd(r.invoiced_total), csv: (r) => r.invoiced_total.toFixed(3) },
    { key: 'paid_total', header: t('reports.sales.paidTotal'), align: 'end',
      cell: (r) => fmtKwd(r.paid_total), csv: (r) => r.paid_total.toFixed(3) },
    { key: 'outstanding_total', header: t('reports.sales.outstandingTotal'), align: 'end',
      cell: (r) => <span className={r.outstanding_total > 0 ? 'text-amber-700' : ''}>{fmtKwd(r.outstanding_total)}</span>,
      csv: (r) => r.outstanding_total.toFixed(3) },
  ];

  return (
    <ReportShell
      title={t('reports.sales.title')}
      rows={rows}
      columns={columns}
      hasDateRange
      fromDate={from}
      toDate={to}
      summaryRow={
        <tr>
          <td className="px-4 py-2.5">{t('common.total')}</td>
          <td className="px-4 py-2.5 text-end font-mono">{fmtInt(totalInvoices)}</td>
          <td className="px-4 py-2.5 text-end font-mono">{fmtKwd(totalInvoiced)}</td>
          <td className="px-4 py-2.5 text-end font-mono">{fmtKwd(totalPaid)}</td>
          <td className="px-4 py-2.5 text-end font-mono">{fmtKwd(totalOutstanding)}</td>
        </tr>
      }
    />
  );
}
