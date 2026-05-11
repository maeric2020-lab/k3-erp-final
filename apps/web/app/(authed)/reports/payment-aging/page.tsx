import { requireScreen } from '@/lib/auth/require-screen';
import { ReportsRepository } from '@k3/repositories';
import { getTranslations } from 'next-intl/server';
import { ReportShell, fmtKwd, type ReportColumn } from '@/components/reports/report-shell';
import type { PaymentAgingRow } from '@k3/repositories';

export const dynamic = 'force-dynamic';

export default async function PaymentAgingReportPage() {
  const ctx = await requireScreen('report_payment_aging', 'view');
  const repo = new ReportsRepository(ctx.supabase);
  const rows = await repo.paymentAging();
  const t = await getTranslations();

  const totals = rows.reduce(
    (s, r) => ({
      current: s.current + r.current_total,
      d1_30: s.d1_30 + r.d1_30,
      d31_60: s.d31_60 + r.d31_60,
      d61_90: s.d61_90 + r.d61_90,
      d90_plus: s.d90_plus + r.d90_plus,
      total: s.total + r.total_outstanding,
    }),
    { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0 }
  );

  const columns: ReportColumn<PaymentAgingRow>[] = [
    { key: 'customer', header: t('reports.paymentAging.customer'),
      cell: (r) => <span dir="auto">{r.customer_name}</span>,
      csv: (r) => r.customer_name },
    { key: 'current', header: t('reports.paymentAging.current'), align: 'end',
      cell: (r) => fmtKwd(r.current_total), csv: (r) => r.current_total.toFixed(3) },
    { key: 'd1_30', header: t('reports.paymentAging.d1_30'), align: 'end',
      cell: (r) => <span className={r.d1_30 > 0 ? 'text-amber-700' : ''}>{fmtKwd(r.d1_30)}</span>,
      csv: (r) => r.d1_30.toFixed(3) },
    { key: 'd31_60', header: t('reports.paymentAging.d31_60'), align: 'end',
      cell: (r) => <span className={r.d31_60 > 0 ? 'text-amber-700' : ''}>{fmtKwd(r.d31_60)}</span>,
      csv: (r) => r.d31_60.toFixed(3) },
    { key: 'd61_90', header: t('reports.paymentAging.d61_90'), align: 'end',
      cell: (r) => <span className={r.d61_90 > 0 ? 'text-orange-700' : ''}>{fmtKwd(r.d61_90)}</span>,
      csv: (r) => r.d61_90.toFixed(3) },
    { key: 'd90_plus', header: t('reports.paymentAging.d90Plus'), align: 'end',
      cell: (r) => <span className={r.d90_plus > 0 ? 'text-red-700 font-semibold' : ''}>{fmtKwd(r.d90_plus)}</span>,
      csv: (r) => r.d90_plus.toFixed(3) },
    { key: 'total', header: t('reports.paymentAging.totalOutstanding'), align: 'end',
      cell: (r) => <span className="font-semibold">{fmtKwd(r.total_outstanding)}</span>,
      csv: (r) => r.total_outstanding.toFixed(3) },
  ];

  return (
    <ReportShell
      title={t('reports.paymentAging.title')}
      rows={rows}
      columns={columns}
      isSnapshot
      summaryRow={
        <tr>
          <td className="px-4 py-2.5">{t('common.total')}</td>
          <td className="px-4 py-2.5 text-end font-mono">{fmtKwd(totals.current)}</td>
          <td className="px-4 py-2.5 text-end font-mono">{fmtKwd(totals.d1_30)}</td>
          <td className="px-4 py-2.5 text-end font-mono">{fmtKwd(totals.d31_60)}</td>
          <td className="px-4 py-2.5 text-end font-mono">{fmtKwd(totals.d61_90)}</td>
          <td className="px-4 py-2.5 text-end font-mono text-red-700">{fmtKwd(totals.d90_plus)}</td>
          <td className="px-4 py-2.5 text-end font-mono">{fmtKwd(totals.total)}</td>
        </tr>
      }
    />
  );
}
