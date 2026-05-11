'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Plus, Trash2, X, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import type { Invoice, Customer, DocumentLine, Payment, Job } from '@k3/repositories';

interface Props {
  invoice: Invoice;
  customer: Customer | null;
  initialLines: DocumentLine[];
  initialPayments: Payment[];
  job: Job | null;
  canEditInvoice: boolean;
  canAddPayment: boolean;
}

const STATUS_CLS: Record<string, string> = {
  issued: 'bg-blue-50 text-blue-700',
  partial: 'bg-amber-50 text-amber-700',
  paid: 'bg-green-50 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
  void: 'bg-gray-100 text-gray-500',
};

const PAYMENT_METHODS = ['cash', 'knet', 'transfer', 'cheque', 'card', 'other'] as const;

export function InvoiceDetailClient({
  invoice: initialInvoice,
  customer,
  initialLines,
  initialPayments,
  job,
  canEditInvoice,
  canAddPayment,
}: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [invoice, setInvoice] = useState(initialInvoice);
  const [lines] = useState(initialLines);
  const [payments, setPayments] = useState(initialPayments);
  const [showPay, setShowPay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pay, setPay] = useState({
    amount: Number(invoice.balance) || 0,
    method: 'cash' as typeof PAYMENT_METHODS[number],
    reference: '',
    payment_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const refresh = async () => {
    const r = await fetch(`/api/invoices/${invoice.id}`).then((r) => r.json());
    setInvoice(r.invoice);
    setPayments(r.payments ?? []);
    router.refresh();
  };

  const submitPayment = async () => {
    setError(null);
    setBusy(true);
    try {
      if (!pay.amount || pay.amount <= 0) throw new Error('Amount must be > 0');
      const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pay),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      setShowPay(false);
      setPay({ amount: 0, method: 'cash', reference: '', payment_date: new Date().toISOString().slice(0, 10), notes: '' });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removePayment = async (pid: string) => {
    if (!confirm(t('common.deleteConfirm'))) return;
    await fetch(`/api/payments/${pid}`, { method: 'DELETE' });
    await refresh();
  };

  const voidInvoice = async () => {
    if (!confirm(t('common.deleteConfirm'))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'void' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-mono text-sm text-gray-500">{invoice.invoice_no}</div>
          <h1 className="text-2xl font-bold text-gray-900">{customer?.name_ar ?? '—'}</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2.5 py-1 rounded-full text-xs ${STATUS_CLS[invoice.status] ?? ''}`}>
            {t(`finance.invoices.statuses.${invoice.status}` as any)}
          </span>
          {invoice.is_zero_charge && (
            <span className="px-2.5 py-1 rounded-full text-xs bg-green-100 text-green-700">
              {t('finance.invoices.zeroCharge')}
            </span>
          )}
        </div>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      {job && (
        <Link href={`/operations/jobs/${job.id}`} className="inline-flex items-center gap-2 text-sm text-brand-600 hover:underline">
          <Briefcase className="w-4 h-4" />
          {t('operations.jobs.title')}: {job.job_no}
        </Link>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: lines + facts */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6">
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <Field label={t('finance.invoices.issueDate')} value={invoice.issue_date} mono />
              <Field label={t('finance.invoices.dueDate')} value={invoice.due_date ?? '—'} mono />
              <Field label={t('finance.invoices.subtotal')} value={`${Number(invoice.subtotal).toFixed(3)}`} mono />
              <Field label={t('finance.invoices.discount')} value={`${Number(invoice.discount).toFixed(3)}`} mono />
              <Field label={t('common.total')} value={`${Number(invoice.total_amount).toFixed(3)}`} mono />
              <Field label={t('finance.invoices.balance')} value={`${Number(invoice.balance).toFixed(3)}`} mono />
            </div>
            {invoice.notes && (
              <div className="pt-4 mt-4 border-t border-gray-200">
                <Label>{t('common.notes')}</Label>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold mb-3">{t('operations.jobs.lineItems')}</h2>
            {lines.length === 0 ? (
              <p className="text-sm text-gray-500 py-3">{t('operations.jobs.noLines')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 border-b border-gray-200">
                    <tr>
                      <th className="text-start py-2">{t('common.name')}</th>
                      <th className="text-end py-2 w-20">{t('masters.unit')}</th>
                      <th className="text-end py-2 w-16">×</th>
                      <th className="text-end py-2 w-24">{t('masters.sellingPrice')}</th>
                      <th className="text-end py-2 w-24">{t('common.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.id} className="border-b border-gray-100 last:border-b-0">
                        <td className="py-2" dir="auto">
                          <div>{locale === 'ar' ? l.description_ar : (l.description_en || l.description_ar)}</div>
                          {l.is_covered && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px]">
                              {t('operations.jobs.covered')}
                            </span>
                          )}
                        </td>
                        <td className="text-end font-mono text-xs">{l.unit}</td>
                        <td className="text-end font-mono">{l.quantity}</td>
                        <td className="text-end font-mono">{Number(l.unit_price).toFixed(3)}</td>
                        <td className="text-end font-mono">{Number(l.line_total).toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right: payments */}
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">{t('finance.payments.title')}</h2>
              {canAddPayment && Number(invoice.balance) > 0 && !['cancelled','void'].includes(invoice.status) && !showPay && (
                <Button size="sm" onClick={() => { setPay((s) => ({ ...s, amount: Number(invoice.balance) })); setShowPay(true); }}>
                  <Plus className="w-4 h-4 me-1" />{t('finance.invoices.recordPayment')}
                </Button>
              )}
            </div>

            {showPay && (
              <div className="mb-4 p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{t('finance.invoices.recordPayment')}</h3>
                  <button onClick={() => setShowPay(false)} className="p-1 rounded hover:bg-gray-100"><X className="w-4 h-4" /></button>
                </div>
                <div>
                  <Label htmlFor="pay_amt" required>{t('finance.payments.amount')}</Label>
                  <Input id="pay_amt" type="number" step="0.001" value={pay.amount}
                    onChange={(e) => setPay((s) => ({ ...s, amount: Number(e.target.value) || 0 }))} dir="ltr" />
                </div>
                <div>
                  <Label htmlFor="pay_method" required>{t('finance.payments.method')}</Label>
                  <select id="pay_method" value={pay.method}
                    onChange={(e) => setPay((s) => ({ ...s, method: e.target.value as any }))}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                    {PAYMENT_METHODS.map((m) => (<option key={m} value={m}>{t(`finance.payments.methods.${m}` as any)}</option>))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="pay_date" required>{t('finance.payments.paymentDate')}</Label>
                  <Input id="pay_date" type="date" value={pay.payment_date}
                    onChange={(e) => setPay((s) => ({ ...s, payment_date: e.target.value }))} dir="ltr" />
                </div>
                <div>
                  <Label htmlFor="pay_ref">{t('finance.payments.reference')}</Label>
                  <Input id="pay_ref" value={pay.reference}
                    onChange={(e) => setPay((s) => ({ ...s, reference: e.target.value }))} dir="ltr" />
                </div>
                <Button onClick={submitPayment} disabled={busy} className="w-full">
                  {busy ? t('common.loading') : t('common.save')}
                </Button>
              </div>
            )}

            {payments.length === 0 ? (
              <p className="text-sm text-gray-500 py-3">{t('common.noData')}</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-md border border-gray-200">
                    <div>
                      <div className="font-mono text-xs text-gray-500">{p.payment_no}</div>
                      <div className="font-medium font-mono text-sm">{Number(p.amount).toFixed(3)} KWD</div>
                      <div className="text-xs text-gray-500">
                        {t(`finance.payments.methods.${p.method}` as any)} · {p.payment_date}
                      </div>
                      {p.reference && <div className="text-xs text-gray-500" dir="auto">{p.reference}</div>}
                    </div>
                    {canAddPayment && (
                      <button onClick={() => removePayment(p.id)} className="p-1.5 rounded text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {canEditInvoice && !['cancelled','void'].includes(invoice.status) && (
            <Card className="p-6">
              <Button variant="outline" onClick={voidInvoice} disabled={busy} className="w-full text-red-600 hover:bg-red-50">
                {t('finance.invoices.void')}
              </Button>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className={`font-medium ${mono ? 'font-mono text-sm' : ''}`}>{value}</div>
    </div>
  );
}
