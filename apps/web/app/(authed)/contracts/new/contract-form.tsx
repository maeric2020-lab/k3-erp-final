'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { contractSchema, type ContractInput, CONTRACT_TYPES } from '@k3/validators';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Alert } from '@/components/ui/alert';

interface Props {
  customers: Array<{ id: string; label: string }>;
}

export function ContractForm({ customers }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ContractInput>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      contract_no: '',
      customer_id: '',
      contract_type: 'CO',
      is_4_year: false,
      start_date: '',
      end_date: '',
      status: 'draft',
      notes: '',
    },
  });

  const onSubmit = async (values: ContractInput) => {
    setError(null);
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      const body = await res.json();
      router.push(`/contracts/${body.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="bg-white p-6 rounded-lg border border-gray-200 space-y-4">
      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="contract_no" required>{t('operations.contracts.contractNo')}</Label>
          <Input id="contract_no" {...form.register('contract_no')} dir="ltr" placeholder="(123/26) CW" />
          {form.formState.errors.contract_no && <p className="text-xs text-red-600 mt-1">{form.formState.errors.contract_no.message as string}</p>}
        </div>
        <div>
          <Label htmlFor="customer_id" required>{t('operations.requests.customer')}</Label>
          <select
            id="customer_id"
            {...form.register('customer_id')}
            className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="">—</option>
            {customers.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
          </select>
        </div>
        <div>
          <Label htmlFor="contract_type" required>{t('operations.contracts.type')}</Label>
          <select
            id="contract_type"
            {...form.register('contract_type')}
            className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            {CONTRACT_TYPES.map((tp) => (<option key={tp} value={tp}>{tp}</option>))}
          </select>
        </div>
        <div className="flex items-end gap-2 pb-2">
          <Switch checked={form.watch('is_4_year')} onCheckedChange={(v) => form.setValue('is_4_year', v)} />
          <Label className="!mb-0">{t('operations.contracts.fourYear')}</Label>
        </div>
        <div>
          <Label htmlFor="start_date" required>{t('operations.contracts.startDate')}</Label>
          <Input id="start_date" type="date" {...form.register('start_date')} dir="ltr" />
        </div>
        <div>
          <Label htmlFor="end_date" required>{t('operations.contracts.endDate')}</Label>
          <Input id="end_date" type="date" {...form.register('end_date')} dir="ltr" />
        </div>
      </div>

      <div>
        <Label htmlFor="notes">{t('common.notes')}</Label>
        <textarea
          id="notes"
          {...form.register('notes')}
          className="w-full min-h-[80px] px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t('common.loading') : t('common.save')}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>{t('common.cancel')}</Button>
      </div>
    </form>
  );
}
