'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { quotationSchema, type QuotationInput } from '@k3/validators';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

interface Props { customers: Array<{ id: string; label: string }> }

export function QuotationForm({ customers }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<QuotationInput>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      customer_id: '',
      request_type: 'CASH',
      status: 'draft',
      issue_date: new Date().toISOString().slice(0, 10),
      valid_until: '',
      discount: 0,
      notes: '',
    },
  });

  const onSubmit = async (values: QuotationInput) => {
    setError(null);
    try {
      const res = await fetch('/api/quotations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      const body = await res.json();
      router.push(`/sales/quotations/${body.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="bg-white p-6 rounded-lg border border-gray-200 space-y-4">
      {error && <Alert variant="destructive">{error}</Alert>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="customer_id" required>{t('operations.requests.customer')}</Label>
          <select id="customer_id" {...form.register('customer_id')}
            className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
            <option value="">—</option>
            {customers.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
          </select>
        </div>
        <div>
          <Label htmlFor="request_type">{t('operations.requests.requestType')}</Label>
          <select id="request_type" {...form.register('request_type')}
            className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
            <option value="CASH">CASH</option>
            <option value="CO">CO</option>
            <option value="CW">CW</option>
            <option value="CWC">CWC</option>
            <option value="UG">UG</option>
          </select>
        </div>
        <div>
          <Label htmlFor="issue_date" required>{t('finance.quotations.issueDate')}</Label>
          <Input id="issue_date" type="date" {...form.register('issue_date')} dir="ltr" />
        </div>
        <div>
          <Label htmlFor="valid_until">{t('finance.quotations.validUntil')}</Label>
          <Input id="valid_until" type="date" {...form.register('valid_until')} dir="ltr" />
        </div>
        <div>
          <Label htmlFor="discount">{t('finance.quotations.discount')}</Label>
          <Input id="discount" type="number" step="any" {...form.register('discount', { valueAsNumber: true })} dir="ltr" />
        </div>
      </div>
      <div>
        <Label htmlFor="notes">{t('common.notes')}</Label>
        <textarea id="notes" {...form.register('notes')}
          className="w-full min-h-[80px] px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white" />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? t('common.loading') : t('common.save')}</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>{t('common.cancel')}</Button>
      </div>
    </form>
  );
}
