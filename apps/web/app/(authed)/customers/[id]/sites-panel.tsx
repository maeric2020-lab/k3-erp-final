'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Star, StarOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import type { CustomerSite } from '@k3/repositories';
import { customerSiteSchema, type CustomerSiteInput } from '@k3/validators';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

interface Props {
  customerId: string;
  initialSites: CustomerSite[];
}

export function CustomerSitesPanel({ customerId, initialSites }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [sites, setSites] = useState<CustomerSite[]>(initialSites);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CustomerSiteInput>({
    resolver: zodResolver(customerSiteSchema),
    defaultValues: {
      customer_id: customerId,
      site_name: '',
      governorate: '',
      area: '',
      block: '',
      street: '',
      avenue: '',
      building: '',
      full_address: '',
      is_primary: sites.length === 0,
      is_active: true,
    },
  });

  const refresh = async () => {
    const res = await fetch(`/api/customers/${customerId}/sites`);
    if (res.ok) {
      const json = await res.json();
      setSites(json.sites ?? []);
    }
    router.refresh();
  };

  const onSubmit = async (values: CustomerSiteInput) => {
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/sites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      form.reset({
        customer_id: customerId,
        site_name: '',
        governorate: '',
        area: '',
        block: '',
        street: '',
        avenue: '',
        building: '',
        full_address: '',
        is_primary: false,
        is_active: true,
      });
      setShowForm(false);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const setPrimary = async (siteId: string) => {
    await fetch(`/api/customers/${customerId}/sites/${siteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_primary: true }),
    });
    await refresh();
  };

  const remove = async (siteId: string) => {
    if (!confirm(t('common.deleteConfirm'))) return;
    await fetch(`/api/customers/${customerId}/sites/${siteId}`, { method: 'DELETE' });
    await refresh();
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{t('customers.sites')}</h2>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 me-1" />
            {t('customers.addSite')}
          </Button>
        )}
      </div>

      {showForm && (
        <form onSubmit={form.handleSubmit(onSubmit)} className="mb-6 space-y-3 p-4 rounded-lg bg-gray-50 border border-gray-200">
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="site_name">{t('customers.site.name')}</Label>
              <Input id="site_name" {...form.register('site_name')} />
            </div>
            <div>
              <Label htmlFor="governorate">{t('customers.site.governorate')}</Label>
              <Input id="governorate" {...form.register('governorate')} />
            </div>
            <div>
              <Label htmlFor="area">{t('customers.site.area')}</Label>
              <Input id="area" {...form.register('area')} />
            </div>
            <div>
              <Label htmlFor="block">{t('customers.site.block')}</Label>
              <Input id="block" {...form.register('block')} />
            </div>
            <div>
              <Label htmlFor="street">{t('customers.site.street')}</Label>
              <Input id="street" {...form.register('street')} />
            </div>
            <div>
              <Label htmlFor="avenue">{t('customers.site.avenue')}</Label>
              <Input id="avenue" {...form.register('avenue')} />
            </div>
            <div>
              <Label htmlFor="building">{t('customers.site.building')}</Label>
              <Input id="building" {...form.register('building')} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="full_address">{t('customers.site.fullAddress')}</Label>
              <Input id="full_address" {...form.register('full_address')} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
              {t('common.save')}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {sites.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">{t('common.noData')}</p>
        ) : (
          sites.map((s) => (
            <div key={s.id} className="flex items-start justify-between p-3 rounded-md border border-gray-200">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.site_name ?? `${s.area ?? ''} ${s.block ?? ''}`}</span>
                  {s.is_primary && (
                    <span className="inline-block px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-xs">
                      {t('customers.site.isPrimary')}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-600">
                  {[s.governorate, s.area, s.block, s.street, s.avenue, s.building].filter(Boolean).join(' / ')}
                </div>
                {s.full_address && <div className="text-xs text-gray-500">{s.full_address}</div>}
              </div>
              <div className="flex items-center gap-1">
                {!s.is_primary && (
                  <button
                    onClick={() => setPrimary(s.id)}
                    title={t('customers.site.isPrimary')}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                  >
                    <StarOff className="w-4 h-4" />
                  </button>
                )}
                {s.is_primary && <Star className="w-4 h-4 text-amber-500 m-1.5" />}
                <button
                  onClick={() => remove(s.id)}
                  title={t('common.delete')}
                  className="p-1.5 rounded hover:bg-red-50 text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
