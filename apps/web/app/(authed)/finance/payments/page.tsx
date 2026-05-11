import { requireScreen } from '@/lib/auth/require-screen';
import { PaymentsRepository, CustomersRepository, InvoicesRepository } from '@k3/repositories';
import { PaymentsClient } from './payments-client';

export const dynamic = 'force-dynamic';

export default async function PaymentsListPage() {
  const ctx = await requireScreen('payments', 'view');
  const repo = new PaymentsRepository(ctx.supabase);
  const customers = new CustomersRepository(ctx.supabase);
  const invoices = new InvoicesRepository(ctx.supabase);

  const [rows, total, customerList, invoiceList] = await Promise.all([
    repo.list({ limit: 200, order_by: 'payment_date', ascending: false }),
    repo.count(),
    customers.list({ active_only: true, limit: 1000 }),
    invoices.list({ limit: 1000 }),
  ]);
  const customerById = new Map(customerList.map((c) => [c.id, c.name_ar]));
  const invoiceById = new Map(invoiceList.map((i) => [i.id, i.invoice_no]));
  const enriched = rows.map((p) => ({
    ...p,
    customer_name: customerById.get(p.customer_id) ?? '—',
    invoice_no: invoiceById.get(p.invoice_id) ?? '—',
  }));

  return <PaymentsClient initialRows={enriched as any} total={total} />;
}
