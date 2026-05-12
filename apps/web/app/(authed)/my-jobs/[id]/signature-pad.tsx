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
import type { SparePartMaster, SparePartCategory, MachineCategory, MachineBrand } from '@k3/repositories';

interface Props {
  title: string;
  rows: any[];
  total: number;
  partCategories: SparePartCategory[];
  machineCategories: MachineCategory[];
  brands: MachineBrand[];
  canAdd: boolean;
  canEdit: boolean;
  locale: 'ar' | 'en';
}

export function SparePartsClient(props: Props) {
  const t = useTranslations();
  const router = useRouter();
  const lbl = (c: { name_ar: string; name_en: string }) => props.locale === 'ar' ? c.name_ar : c.name_en;
  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<any>(emptyForm(props));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function emptyForm(p: Props): any {
    return {
      category_id: p.partCategories[0]?.id ?? '',
      part_type: '',
      name_ar: '', name_en: '',
      brand_id: '', model: '', country_origin: '',
      compatible_categories: [],
      unit: 'piece',
      cost_price: 0, selling_price: 0,
      notes: '', is_active: true,
    };
  }

  const open = (row?: any) => {
    if (row) {
      setEditing(row);
      setCreating(false);
      setForm({
        category_id: row.category_id,
        part_type: row.part_type ?? '',
        name_ar: row.name_ar ?? '',
        name_en: row.name_en ?? '',
        brand_id: row.brand_id ?? '',
        model: row.model ?? '',
        country_origin: row.country_origin ?? '',
        compatible_categories: row.compatible_categories ?? [],
        unit: row.unit ?? 'piece',
        cost_price: row.cost_price ?? 0,
        selling_price: row.selling_price ?? 0,
        notes: row.notes ?? '',
        is_active: row.is_active,
      });
    } else {
      setCreating(true); setEditing(null); setForm(emptyForm(props));
    }
    setError(null);
  };
  const close = () => { setCreating(false); setEditing(null); setError(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSubmitting(true);
    try {
      const url = editing ? `/api/masters/spare-parts/${editing.id}` : '/api/masters/spare-parts';
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      close();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally { setSubmitting(false); }
  };

  const columns: Column<any>[] = [
    { key: 'part_code', header: t('masters.partCode'), className: 'w-32 font-mono text-xs' },
    { key: 'name_ar', header: t('common.name_ar'), cell: (r) => <span className="font-medium">{r.name_ar}</span> },
    { key: 'name_en', header: t('common.name_en'), hideOnMobile: true },
    { key: 'category', header: t('masters.sparePartCategories'), hideOnMobile: true,
      cell: (r) => r.category ? lbl(r.category) : '—' },
    { key: 'brand', header: t('masters.machineBrands'), hideOnMobile: true,
      cell: (r) => r.brand?.name ?? '—' },
    { key: 'selling_price', header: t('masters.sellingPrice'), align: 'end',
      cell: (r) => Number(r.selling_price ?? 0).toFixed(3) },
    { key: 'is_active', header: t('common.status'), align: 'center',
      cell: (r) => r.is_active ? (
        <span className="inline-block px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs">{t('common.active')}</span>
      ) : (<span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">{t('common.inactive')}</span>),
    },
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

  const toggleCat = (id: string) => {
    setForm((s: any) => ({
      ...s,
      compatible_categories: s.compatible_categories.includes(id)
        ? s.compatible_categories.filter((c: string) => c !== id)
        : [...s.compatible_categories, id],
    }));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{props.title}</h1>
      {(creating || editing) && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">{editing ? t('common.edit') : t('common.new')}</h2>
          <form onSubmit={submit} className="space-y-4">
            {error && <Alert variant="destructive">{error}</Alert>}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label required>{t('masters.sparePartCategories')}</Label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm((s: any) => ({ ...s, category_id: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white"
                >
                  <option value="">—</option>
                  {props.partCategories.map((c) => <option key={c.id} value={c.id}>{lbl(c)}</option>)}
                </select>
              </div>
              <div>
                <Label>{t('masters.machineBrands')}</Label>
                <select
                  value={form.brand_id ?? ''}
                  onChange={(e) => setForm((s: any) => ({ ...s, brand_id: e.target.value || null }))}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white"
                >
                  <option value="">—</option>
                  {props.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <Label required>{t('common.name_ar')}</Label>
                <Input value={form.name_ar} onChange={(e) => setForm((s: any) => ({ ...s, name_ar: e.target.value }))} dir="rtl" />
              </div>
              <div>
                <Label required>{t('common.name_en')}</Label>
                <Input value={form.name_en} onChange={(e) => setForm((s: any) => ({ ...s, name_en: e.target.value }))} dir="ltr" />
              </div>
              <div>
                <Label>Model</Label>
                <Input value={form.model ?? ''} onChange={(e) => setForm((s: any) => ({ ...s, model: e.target.value }))} dir="ltr" />
              </div>
              <div>
                <Label>{t('masters.countryOrigin')}</Label>
                <Input value={form.country_origin ?? ''} onChange={(e) => setForm((s: any) => ({ ...s, country_origin: e.target.value }))} dir="ltr" />
              </div>
              <div>
                <Label>{t('masters.unit')}</Label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm((s: any) => ({ ...s, unit: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white"
                >
                  <option value="piece">{t('masters.units.piece')}</option>
                  <option value="meter">{t('masters.units.meter')}</option>
                  <option value="kg">{t('masters.units.kg')}</option>
                  <option value="set">{t('masters.units.set')}</option>
                  <option value="liter">{t('masters.units.liter')}</option>
                </select>
              </div>
              <div className="flex items-end gap-2 pb-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm((s: any) => ({ ...s, is_active: v }))} />
                <Label className="!mb-0">{t('common.active')}</Label>
              </div>
              <div>
                <Label>{t('masters.costPrice')}</Label>
                <Input type="number" step="0.001" value={form.cost_price}
                  onChange={(e) => setForm((s: any) => ({ ...s, cost_price: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>{t('masters.sellingPrice')}</Label>
                <Input type="number" step="0.001" value={form.selling_price}
                  onChange={(e) => setForm((s: any) => ({ ...s, selling_price: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <Label>{t('masters.compatibleCategories')}</Label>
              <div className="flex flex-wrap gap-2 mt-1 p-3 rounded-md border border-gray-200 bg-gray-50">
                {props.machineCategories.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => toggleCat(c.id)}
                    className={`px-3 py-1 text-xs rounded-full border ${
                      form.compatible_categories.includes(c.id)
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {lbl(c)}
                  </button>
                ))}
              </div>
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
