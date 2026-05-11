'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import type { Quotation, Customer, DocumentLine } from '@k3/repositories';

interface Props {
  quotation: Quotation;
  customer: Customer | null;
  initialLines: DocumentLine[];
  canEdit: boolean;
}

const STATUS_CLS: Record<string, string> = {
  draft: 'bg-gray-50 text-gray-600',
  sent: 'bg-blue-50 text-blue-700',
  accepted: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
  expired: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export function QuotationDetailClient({ quotation: initialQuotation, customer, initialLines, canEdit }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [quotation, setQuotation] = useState(initialQuotation);
  const [lines, setLines] = useState(initialLines);
  const [showCustom, setShowCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState({ description_ar: '', description_en: '', quantity: 1, unit: 'unit' });

  const refresh = async () => {
    const r = await fetch(`/api/quotations/${quotation.id}`).then((r) => r.json());
    setQuotation(r.quotation);
    setLines(r.lines ?? []);
    router.refresh();
  };

  const setStatus = async (status: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/quotations/${quotation.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
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

  const removeLine = async (lineId: string) => {
    if (!confirm(t('common.deleteConfirm'))) return;
    await fetch(`/api/quotations/${quotation.id}/lines/${lineId}`, { method: 'DELETE' });
    await refresh();
  };

  // For quotations we keep it simple: a "Custom line" form that uses the
  // documentLineSchema's 'custom' line_type. The full LinePicker (services/parts/gas)
  // is also reachable here but for Phase 4 we ship the custom-line entry which is
  // what most quotations need.
  const addCustomLine = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/quotations/${quotation.id}/lines`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line_type: 'custom',
          description_ar: custom.description_ar.trim() || 'بند مخصص',
          description_en: custom.description_en.trim() || 'Custom item',
          quantity: custom.quantity,
          unit: custom.unit,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      setCustom({ description_ar: '', description_en: '', quantity: 1, unit: 'unit' });
      setShowCustom(false);
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
          <div className="font-mono text-sm text-gray-500">{quotation.quotation_no}</div>
          <h1 className="text-2xl font-bold text-gray-900">{customer?.name_ar ?? '—'}</h1>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs ${STATUS_CLS[quotation.status] ?? ''}`}>
          {t(`finance.quotations.statuses.${quotation.status}` as any)}
        </span>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      <Card className="p-6">
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <Field label={t('finance.quotations.issueDate')} value={quotation.issue_date} mono />
          <Field label={t('finance.quotations.validUntil')} value={quotation.valid_until ?? '—'} mono />
          <Field label={t('operations.requests.requestType')} value={quotation.request_type} mono />
          <Field label={t('finance.quotations.subtotal')} value={`${Number(quotation.subtotal).toFixed(3)} KWD`} mono />
          <Field label={t('finance.quotations.discount')} value={`${Number(quotation.discount).toFixed(3)} KWD`} mono />
          <Field label={t('common.total')} value={`${Number(quotation.total_amount).toFixed(3)} KWD`} mono />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-semibold">{t('operations.jobs.lineItems')}</h2>
          {canEdit && quotation.status === 'draft' && !showCustom && (
            <Button size="sm" onClick={() => setShowCustom(true)}>
              <Plus className="w-4 h-4 me-1" />{t('common.add')}
            </Button>
          )}
        </div>

        {showCustom && (
          <div className="mb-4 p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="d_ar">{t('common.name_ar')}</Label>
                <Input id="d_ar" value={custom.description_ar} onChange={(e) => setCustom((s) => ({ ...s, description_ar: e.target.value }))} dir="rtl" />
              </div>
              <div>
                <Label htmlFor="d_en">{t('common.name_en')}</Label>
                <Input id="d_en" value={custom.description_en} onChange={(e) => setCustom((s) => ({ ...s, description_en: e.target.value }))} dir="ltr" />
              </div>
              <div>
                <Label htmlFor="q">{t('common.total')}</Label>
                <Input id="q" type="number" step="any" value={custom.quantity} onChange={(e) => setCustom((s) => ({ ...s, quantity: Number(e.target.value) || 1 }))} />
              </div>
              <div>
                <Label htmlFor="u">{t('masters.unit')}</Label>
                <Input id="u" value={custom.unit} onChange={(e) => setCustom((s) => ({ ...s, unit: e.target.value }))} dir="ltr" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={addCustomLine} disabled={busy}>{busy ? t('common.loading') : t('common.save')}</Button>
              <Button size="sm" variant="outline" onClick={() => setShowCustom(false)}>{t('common.cancel')}</Button>
            </div>
            <p className="text-xs text-gray-500">
              Custom lines need an admin to set the unit price after creation. The line is saved at 0 KWD until edited.
            </p>
          </div>
        )}

        {lines.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">{t('operations.jobs.noLines')}</p>
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
                  {canEdit && <th className="w-12"></th>}
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-b border-gray-100">
                    <td className="py-2" dir="auto">{locale === 'ar' ? l.description_ar : (l.description_en || l.description_ar)}</td>
                    <td className="text-end font-mono text-xs">{l.unit}</td>
                    <td className="text-end font-mono">{l.quantity}</td>
                    <td className="text-end font-mono">{Number(l.unit_price).toFixed(3)}</td>
                    <td className="text-end font-mono">{Number(l.line_total).toFixed(3)}</td>
                    {canEdit && (
                      <td className="text-end">
                        <button onClick={() => removeLine(l.id)} className="p-1.5 rounded text-red-600 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td colSpan={4} className="text-end py-2">{t('common.total')}</td>
                  <td className="text-end font-mono">{Number(quotation.total_amount).toFixed(3)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {canEdit && (
        <Card className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            {quotation.status === 'draft' && (
              <Button onClick={() => setStatus('sent')} disabled={busy}>{t('finance.quotations.send')}</Button>
            )}
            {quotation.status === 'sent' && (
              <>
                <Button variant="outline" onClick={() => setStatus('accepted')} disabled={busy}>{t('finance.quotations.accept')}</Button>
                <Button variant="outline" onClick={() => setStatus('rejected')} disabled={busy}>{t('finance.quotations.reject')}</Button>
              </>
            )}
            {!['cancelled','accepted','rejected'].includes(quotation.status) && (
              <Button variant="outline" onClick={() => setStatus('cancelled')} disabled={busy}>{t('common.cancel')}</Button>
            )}
          </div>
        </Card>
      )}
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
