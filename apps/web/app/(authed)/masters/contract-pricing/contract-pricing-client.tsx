'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Plus, Pencil } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import type { MachineCategory, MachineBrand, RefrigerantType } from '@k3/repositories';

interface Props {
  title: string;
  rows: any[];
  total: number;
  categories: MachineCategory[];
  brands: MachineBrand[];
  refrigerants: RefrigerantType[];
  canAdd: boolean;
  canEdit: boolean;
  locale: 'ar' | 'en';
}

const PRICE_KEYS = [
  ['co_unit_price', 'CO'],
  ['cw_unit_price', 'CW'],
  ['cwc_unit_price', 'CWC'],
  ['cog_unit_price', 'COG'],
  ['cwg_unit_price', 'CWG'],
  ['cwcg_unit_price', 'CWCG'],
] as const;

export function ContractPricingClient(props: Props) {
  const t = useTranslations();
  const router = useRouter();
  const lbl = (c: { name_ar: string; name_en: string }) => props.locale === 'ar' ? c.name_ar : c.name_en;
  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<any>(empty(props));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function empty(p: Props): any {
    return {
      machine_category_id: p.categories[0]?.id ?? '',
      brand_id: '',
      refrigerant_id: '',
      outdoor_model: '', indoor_model: '',
      capacity_hp: null, capacity_tr: null, btu_h: null, cfm: null, kw: null,
      co_unit_price: 0, cw_unit_price: 0, cwc_unit_price: 0,
      cog_unit_price: 0, cwg_unit_price: 0, cwcg_unit_price: 0,
      is_active: true,
    };
  }

  const open = (row?: any) => {
    if (row) {
      setEditing(row); setCreating(false);
      setForm({ ...empty(props), ...row, brand_id: row.brand_id ?? '', refrigerant_id: row.refrigerant_id ?? '' });
    } else { setCreating(true); setEditing(null); setForm(empty(props)); }
    setError(null);
  };
  const close = () => { setCreating(false); setEditing(null); setError(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSubmitting(true);
    try {
      const body = {
        ...form,
        brand_id: form.brand_id || null,
        refrigerant_id: form.refrigerant_id || null,
      };
      const url = editing ? `/api/masters/contract-pricing/${editing.id}` : '/api/masters/contract-pricing';
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const r = await res.json().catch(() => ({}));
        throw new Error(r.error ?? `${res.status}`);
      }
      close();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally { setSubmitting(false); }
  };

  const columns: Column<any>[] = [
    { key: 'machine_category', header: t('masters.machineCategories'),
      cell: (r) => r.machine_category ? lbl(r.machine_category) : '—' },
    { key: 'brand', header: t('masters.machineBrands'), hideOnMobile: true,
      cell: (r) => r.brand?.name ?? '—' },
    { key: 'outdoor_model', header: t('masters.outdoorModel'), hideOnMobile: true,
      cell: (r) => r.outdoor_model ?? '—' },
    { key: 'capacity_hp', header: 'HP', align: 'center',
      cell: (r) => r.capacity_hp ?? '—' },
    { key: 'co_unit_price', header: 'CO', align: 'end', cell: (r) => Number(r.co_unit_price ?? 0).toFixed(3) },
    { key: 'cw_unit_price', header: 'CW', align: 'end', cell: (r) => Number(r.cw_unit_price ?? 0).toFixed(3) },
    { key: 'cwc_unit_price', header: 'CWC', align: 'end', cell: (r) => Number(r.cwc_unit_price ?? 0).toFixed(3) },
    { key: 'cog_unit_price', header: 'COG', align: 'end', hideOnMobile: true, cell: (r) => Number(r.cog_unit_price ?? 0).toFixed(3) },
    { key: 'cwg_unit_price', header: 'CWG', align: 'end', hideOnMobile: true, cell: (r) => Number(r.cwg_unit_price ?? 0).toFixed(3) },
    { key: 'cwcg_unit_price', header: 'CWCG', align: 'end', hideOnMobile: true, cell: (r) => Number(r.cwcg_unit_price ?? 0).toFixed(3) },
  ];
  if (props.canEdit) {
    columns.push({
      key: '__actions', header: '', align: 'end',
      cell: (r) => (
        <button onClick={() => open(r)} className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 text-sm">
          <Pencil className="w-3.5 h-3.5" />{t('common.edit')}
        </button>
      ),
    });
  }

  const setNum = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value === '' ? null : Number(e.target.value);
    setForm((s: any) => ({ ...s, [key]: v }));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{props.title}</h1>
      {(creating || editing) && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">{editing ? t('common.edit') : t('common.new')}</h2>
          <form onSubmit={submit} className="space-y-4">
            {error && <Alert variant="destructive">{error}</Alert>}
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <Label required>{t('masters.machineCategories')}</Label>
                <select
                  value={form.machine_category_id}
                  onChange={(e) => setForm((s: any) => ({ ...s, machine_category_id: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white"
                >
                  {props.categories.map((c) => <option key={c.id} value={c.id}>{lbl(c)}</option>)}
                </select>
              </div>
              <div>
                <Label>{t('masters.machineBrands')}</Label>
                <select
                  value={form.brand_id ?? ''}
                  onChange={(e) => setForm((s: any) => ({ ...s, brand_id: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white"
                >
                  <option value="">—</option>
                  {props.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <Label>{t('masters.refrigerantTypes')}</Label>
                <select
                  value={form.refrigerant_id ?? ''}
                  onChange={(e) => setForm((s: any) => ({ ...s, refrigerant_id: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white"
                >
                  <option value="">—</option>
                  {props.refrigerants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <Label>{t('masters.outdoorModel')}</Label>
                <Input value={form.outdoor_model ?? ''} onChange={(e) => setForm((s: any) => ({ ...s, outdoor_model: e.target.value }))} dir="ltr" />
              </div>
              <div>
                <Label>{t('masters.indoorModel')}</Label>
                <Input value={form.indoor_model ?? ''} onChange={(e) => setForm((s: any) => ({ ...s, indoor_model: e.target.value }))} dir="ltr" />
              </div>
              <div>
                <Label>{t('masters.capacityHp')}</Label>
                <Input type="number" step="0.01" value={form.capacity_hp ?? ''} onChange={setNum('capacity_hp')} />
              </div>
              <div>
                <Label>{t('masters.capacityTr')}</Label>
                <Input type="number" step="0.01" value={form.capacity_tr ?? ''} onChange={setNum('capacity_tr')} />
              </div>
              <div>
                <Label>{t('masters.btu')}</Label>
                <Input type="number" value={form.btu_h ?? ''} onChange={setNum('btu_h')} />
              </div>
              <div>
                <Label>{t('masters.kw')}</Label>
                <Input type="number" step="0.01" value={form.kw ?? ''} onChange={setNum('kw')} />
              </div>
            </div>
            <div className="border-t pt-4">
              <div className="text-sm font-medium mb-2 text-gray-700">{t('masters.contractPricing')}</div>
              <div className="grid sm:grid-cols-3 gap-4">
                {PRICE_KEYS.map(([key, label]) => (
                  <div key={key}>
                    <Label className="text-xs uppercase font-mono">{label}</Label>
                    <Input
                      type="number" step="0.001"
                      value={form[key] ?? 0}
                      onChange={(e) => setForm((s: any) => ({ ...s, [key]: Number(e.target.value) }))}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm((s: any) => ({ ...s, is_active: v }))} />
              <Label className="!mb-0">{t('common.active')}</Label>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" disabled={submitting}>{submitting ? t('common.loading') : t('common.save')}</Button>
              <Button type="button" variant="outline" onClick={close}>{t('common.cancel')}</Button>
            </div>
          </form>
        </Card>
      )}
      <DataTable
        rows={props.rows}
        columns={columns}
        total={props.total}
        page={1}
        pageSize={50}
        rightAction={props.canAdd && !creating && !editing ? (
          <Button onClick={() => open()}><Plus className="w-4 h-4 me-1" />{t('common.add')}</Button>
        ) : undefined}
      />
    </div>
  );
}
