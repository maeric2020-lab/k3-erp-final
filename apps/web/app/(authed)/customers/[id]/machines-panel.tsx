'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, AirVent } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import type {
  CustomerMachine, CustomerSite, MachineCategory, MachineBrand, RefrigerantType,
} from '@k3/repositories';

interface Props {
  customerId: string;
  sites: CustomerSite[];
  initialMachines: CustomerMachine[];
  categories: MachineCategory[];
  brands: MachineBrand[];
  refrigerants: RefrigerantType[];
}

export function CustomerMachinesPanel(props: Props) {
  const { customerId, sites, initialMachines, categories, brands, refrigerants } = props;
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [machines, setMachines] = useState(initialMachines);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    site_id: '',
    category_id: '',
    brand_id: '',
    refrigerant_id: '',
    outdoor_model: '',
    indoor_model: '',
    capacity_hp: '',
    serial_number: '',
    installation_date: '',
    notes: '',
  });

  const refresh = async () => {
    const res = await fetch(`/api/operations/customer-machines?customer_id=${customerId}`);
    if (res.ok) {
      const j = await res.json();
      setMachines(j.rows ?? []);
    }
    router.refresh();
  };

  const submit = async () => {
    setError(null);
    if (!form.category_id) { setError('Category required'); return; }
    setBusy(true);
    try {
      const payload: any = {
        customer_id: customerId,
        site_id: form.site_id || null,
        category_id: form.category_id,
        brand_id: form.brand_id || null,
        refrigerant_id: form.refrigerant_id || null,
        outdoor_model: form.outdoor_model || null,
        indoor_model: form.indoor_model || null,
        capacity_hp: form.capacity_hp ? Number(form.capacity_hp) : null,
        serial_number: form.serial_number || null,
        installation_date: form.installation_date || null,
        notes: form.notes || null,
        is_active: true,
      };
      const res = await fetch('/api/operations/customer-machines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      setForm({
        site_id: '', category_id: '', brand_id: '', refrigerant_id: '',
        outdoor_model: '', indoor_model: '', capacity_hp: '', serial_number: '',
        installation_date: '', notes: '',
      });
      setShowForm(false);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(t('common.deleteConfirm'))) return;
    await fetch(`/api/operations/customer-machines/${id}`, { method: 'DELETE' });
    await refresh();
  };

  const catById = new Map(categories.map((c) => [c.id, locale === 'ar' ? c.name_ar : c.name_en]));
  const brandById = new Map(brands.map((b) => [b.id, b.name]));
  const refrById = new Map(refrigerants.map((r) => [r.id, r.name]));

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <AirVent className="w-5 h-5 text-gray-400" />
          {t('operations.customerMachines.title')}
        </h2>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 me-1" />{t('operations.customerMachines.newMachine')}
          </Button>
        )}
      </div>

      {showForm && (
        <div className="mb-4 p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-3">
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="cat" required>{t('masters.machineCategories')}</Label>
              <select
                id="cat"
                value={form.category_id}
                onChange={(e) => setForm((s) => ({ ...s, category_id: e.target.value }))}
                className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{locale === 'ar' ? c.name_ar : c.name_en} ({c.code})</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="brand">{t('masters.machineBrands')}</Label>
              <select
                id="brand"
                value={form.brand_id}
                onChange={(e) => setForm((s) => ({ ...s, brand_id: e.target.value }))}
                className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="">—</option>
                {brands.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
              </select>
            </div>
            <div>
              <Label htmlFor="refr">{t('masters.refrigerantTypes')}</Label>
              <select
                id="refr"
                value={form.refrigerant_id}
                onChange={(e) => setForm((s) => ({ ...s, refrigerant_id: e.target.value }))}
                className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="">—</option>
                {refrigerants.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
              </select>
            </div>
            <div>
              <Label htmlFor="site">{t('operations.requests.site')}</Label>
              <select
                id="site"
                value={form.site_id}
                onChange={(e) => setForm((s) => ({ ...s, site_id: e.target.value }))}
                className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="">—</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.site_name ?? `${s.area ?? ''} ${s.block ?? ''}`}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="outdoor">{t('masters.outdoorModel')}</Label>
              <Input id="outdoor" value={form.outdoor_model} onChange={(e) => setForm((s) => ({ ...s, outdoor_model: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <Label htmlFor="indoor">{t('masters.indoorModel')}</Label>
              <Input id="indoor" value={form.indoor_model} onChange={(e) => setForm((s) => ({ ...s, indoor_model: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <Label htmlFor="hp">{t('masters.capacityHp')}</Label>
              <Input id="hp" type="number" step="any" value={form.capacity_hp} onChange={(e) => setForm((s) => ({ ...s, capacity_hp: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="serial">{t('operations.customerMachines.serial')}</Label>
              <Input id="serial" value={form.serial_number} onChange={(e) => setForm((s) => ({ ...s, serial_number: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <Label htmlFor="inst">{t('operations.customerMachines.installDate')}</Label>
              <Input id="inst" type="date" value={form.installation_date} onChange={(e) => setForm((s) => ({ ...s, installation_date: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={submit} disabled={busy}>{busy ? t('common.loading') : t('common.save')}</Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {machines.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">{t('common.noData')}</p>
        ) : (
          machines.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-3 p-3 rounded-md border border-gray-200">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                  <span>{catById.get(m.category_id) ?? '—'}</span>
                  {m.brand_id && <span className="text-gray-600">{brandById.get(m.brand_id)}</span>}
                  {m.refrigerant_id && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{refrById.get(m.refrigerant_id)}</span>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 font-mono" dir="ltr">
                  {[m.outdoor_model, m.indoor_model].filter(Boolean).join(' / ') || '—'}
                  {m.capacity_hp && ` · ${m.capacity_hp} HP`}
                  {m.serial_number && ` · S/N ${m.serial_number}`}
                </div>
              </div>
              <button
                onClick={() => remove(m.id)}
                title={t('common.delete')}
                className="p-1.5 rounded text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
