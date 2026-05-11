'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { customerSchema, type CustomerInput } from '@k3/validators';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Alert } from '@/components/ui/alert';
import type { Customer } from '@k3/repositories';

interface Props {
  mode: 'create' | 'edit';
  customer?: Customer;
}

export function CustomerForm({ mode, customer }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  const form = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name_ar: customer?.name_ar ?? '',
      name_en: customer?.name_en ?? '',
      customer_type: customer?.customer_type ?? 'individual',
      civil_id: customer?.civil_id ?? '',
      email: customer?.email ?? '',
      phone_primary: customer?.phone_primary ?? '',
      phone_secondary: customer?.phone_secondary ?? '',
      notes: customer?.notes ?? '',
      is_active: customer?.is_active ?? true,
    },
  });

  const onSubmit = async (values: CustomerInput) => {
    setServerError(null);
    try {
      const url = mode === 'create' ? '/api/customers' : `/api/customers/${customer!.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      const body = await res.json();
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
      if (mode === 'create' && body.id) {
        router.push(`/customers/${body.id}`);
      } else {
        router.refresh();
      }
    } catch (e) {
      setServerError((e as Error).message);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 bg-white p-6 rounded-lg border border-gray-200">
      {serverError && <Alert variant="destructive">{serverError}</Alert>}
      {savedNotice && <Alert variant="success">{t('common.saved')}</Alert>}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name_ar" required>{t('common.name_ar')}</Label>
          <Input id="name_ar" {...form.register('name_ar')} dir="rtl" />
          {form.formState.errors.name_ar && (
            <p className="text-xs text-red-600 mt-1">{form.formState.errors.name_ar.message as string}</p>
          )}
        </div>
        <div>
          <Label htmlFor="name_en">{t('common.name_en')}</Label>
          <Input id="name_en" {...form.register('name_en')} dir="ltr" />
        </div>
        <div>
          <Label htmlFor="customer_type">{t('customers.type')}</Label>
          <select
            id="customer_type"
            {...form.register('customer_type')}
            className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="individual">{t('customers.types.individual')}</option>
            <option value="company">{t('customers.types.company')}</option>
            <option value="government">{t('customers.types.government')}</option>
          </select>
        </div>
        <div>
          <Label htmlFor="civil_id">{t('customers.civilId')}</Label>
          <Input id="civil_id" {...form.register('civil_id')} dir="ltr" />
        </div>
        <div>
          <Label htmlFor="phone_primary">{t('customers.phonePrimary')}</Label>
          <Input id="phone_primary" {...form.register('phone_primary')} dir="ltr" />
        </div>
        <div>
          <Label htmlFor="phone_secondary">{t('customers.phoneSecondary')}</Label>
          <Input id="phone_secondary" {...form.register('phone_secondary')} dir="ltr" />
        </div>
        <div>
          <Label htmlFor="email">{t('common.email')}</Label>
          <Input id="email" type="email" {...form.register('email')} dir="ltr" />
          {form.formState.errors.email && (
            <p className="text-xs text-red-600 mt-1">{form.formState.errors.email.message as string}</p>
          )}
        </div>
        <div className="flex items-end gap-2 pb-2">
          <Switch checked={form.watch('is_active')} onCheckedChange={(v) => form.setValue('is_active', v)} />
          <Label className="!mb-0">{t('common.active')}</Label>
        </div>
      </div>

      <div>
        <Label htmlFor="notes">{t('common.notes')}</Label>
        <textarea
          id="notes"
          {...form.register('notes')}
          className="w-full min-h-[90px] px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
          {form.formState.isSubmitting ? t('common.loading') : t('common.save')}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}
