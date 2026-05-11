import { requireScreen } from '@/lib/auth/require-screen';
import { ReportsRepository } from '@k3/repositories';
import { getLocale, getTranslations } from 'next-intl/server';
import { ReportShell, fmtKwd, fmtInt, type ReportColumn } from '@/components/reports/report-shell';
import type { CustomerBalanceRow } from '@k3/repositories';

export const dynamic = 'force-dynamic';

export default async function CustomerBalancesReportPage() {
  const ctx = await requireScreen('report_customer_balances', 'view');
  const repo = new ReportsRepository(ctx.supabase);
  const rows = await repo.customerBalances();
  const t = await getTranslations();
  const locale = await getLocale();

  const totalInvoiced = rows.reduce((s, r) => s + r.total_invoiced, 0);
  const totalPaid = rows.reduce((s, r) => s + r.total_paid, 0);
  const totalOutstanding = rows.reduce((s, r) => s + r.total_outstanding, 0);
  const totalInvoices = rows.reduce((s, r) => s + r.invoice_count, 0);

  const columns: ReportColumn<CustomerBalanceRow>[] = [
    { key: 'code', header: t('reports.customerBalances.code'), hideOnMobile: true,
      cell: (r) => <span className="font-mono text-xs">{r.customer_code}</span>,
      csv: (r) => r.customer_code },
    { key: 'name', header: t('reports.customerBalances.name'),
      cell: (r) => <span dir="auto">{locale === 'ar' ? r.customer_name_ar : (r.customer_name_en || r.customer_name_ar)}</span>,
      csv: (r) => locale === 'ar' ? r.customer_name_ar : (r.customer_name_en || r.customer_name_ar) },
    { key: 'invoiced', header: t('reports.customerBalances.totalInvoiced'), align: 'end', hideOnMobile: true,
      cell: (r) => fmtKwd(r.total_invoiced), csv: (r) => r.total_invoiced.toFixed(3) },
    { key: 'paid', header: t('reports.customerBalances.totalPaid'), align: 'end', hideOnMobile: true,
      cell: (r) => <span className="text-green-700">{fmtKwd(r.total_paid)}</span>,
      csv: (r) => r.total_paid.toFixed(3) },
    { key: 'outstanding', header: t('reports.customerBalances.totalOutstanding'), align: 'end',
      cell: (r) => <span className="text-amber-700 font-semibold">{fmtKwd(r.total_outstanding)}</span>,
      csv: (r) => r.total_outstanding.toFixed(3) },
    { key: 'invoices', header: t('reports.customerBalances.invoiceCount'), align: 'end', hideOnMobile: true,
      cell: (r) => fmtInt(r.invoice_count), csv: (r) => r.invoice_count },
  ];

  return (
    <ReportShell
      title={t('reports.customerBalances.title')}
      rows={rows}
      columns={columns}
      isSnapshot
      summaryRow={
        <tr>
          <td className="px-4 py-2.5 hidden md:table-cell">—</td>
          <td className="px-4 py-2.5">{t('common.total')}</td>
          <td className="px-4 py-2.5 text-end font-mono hidden md:table-cell">{fmtKwd(totalInvoiced)}</td>
          <td className="px-4 py-2.5 text-end font-mono text-green-700 hidden md:table-cell">{fmtKwd(totalPaid)}</td>
          <td className="px-4 py-2.5 text-end font-mono text-amber-700">{fmtKwd(totalOutstanding)}</td>
          <td className="px-4 py-2.5 text-end font-mono hidden md:table-cell">{fmtInt(totalInvoices)}</td>
        </tr>
      }
    />
  );
}
