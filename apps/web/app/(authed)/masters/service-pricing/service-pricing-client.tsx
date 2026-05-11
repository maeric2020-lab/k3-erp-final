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
import type { ServiceMaster, MachineCategory } from '@k3/repositories';

interface Props {
  title: string;
  rows: any[];
  total: number;
  services: ServiceMaster[];
  machineCategories: MachineCategory[];
  canAdd: boolean;
  canEdit: boolean;
  locale: 'ar' | 'en';
}

const TYPES = ['cash', 'co', 'cw', 'cwc', 'ug'] as const;
type ReqType = typeof TYPES[number];

export function ServicePricingClient(props: Props) {
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
      service_id: p.services[0]?.id ?? '',
      machine_category_id: '',
      cost_price: 0,
      cash_price: 0, cash_covered: false,
      co_price: 0, co_covered: false,
      cw_price: 0, cw_covered: false,
      cwc_price: 0, cwc_covered: false,
      ug_price: 0, ug_covered: true, // UG always covered
      is_active: true,
    };
  }

  const open = (row?: any) => {
    if (row) {
      setEditing(row); setCreating(false);
      setForm({
        service_id: row.service_id,
        machine_category_id: row.machine_category_id ?? '',
        cost_price: row.cost_price,
        cash_price: row.cash_price, cash_covered: row.cash_covered,
        co_price: row.co_price, co_covered: row.co_covered,
        cw_price: row.cw_price, cw_covered: row.cw_covered,
        cwc_price: row.cwc_price, cwc_covered: row.cwc_covered,
        ug_price: row.ug_price, ug_covered: row.ug_covered,
        is_active: row.is_active,
      });
    } else { setCreating(true); setEditing(null); setForm(empty(props)); }
    setError(null);
  };
  const close = () => { setCreating(false); setEditing(null); setError(null); };

  const toggleCovered = (key: ReqType, v: boolean) => {
    setForm((s: any) => ({
      ...s,
      [`${key}_covered`]: v,
      // If covering, force price to 0 (matches DB CHECK constraint)
      [`${key}_price`]: v ? 0 : s[`${key}_price`],
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSubmitting(true);
    try {
      const body = { ...form, machine_category_id: form.machine_category_id || null };
      const url = editing ? `/api/masters/service-pricing/${editing.id}` : '/api/masters/service-pricing';
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
    { key: 'service', header: t('masters.servicesMaster'),
      cell: (r) => r.service ? (<span className="font-medium">{lbl(r.service)}</span>) : '—' },
    { key: 'machine_category', header: t('masters.machineCategories'), hideOnMobile: true,
      cell: (r) => r.machine_category ? lbl(r.machine_category) : '—' },
    { key: 'cost_price', header: t('masters.costPrice'), align: 'end', hideOnMobile: true,
      cell: (r) => Number(r.cost_price ?? 0).toFixed(3) },
    { key: 'cash_price', header: 'CASH', align: 'end',
      cell: (r) => r.cash_covered ? <span className="text-green-700 text-xs">✓</span> : Number(r.cash_price ?? 0).toFixed(3) },
    { key: 'co_price', header: 'CO', align: 'end',
      cell: (r) => r.co_covered ? <span className="text-green-700 text-xs">✓</span> : Number(r.co_price ?? 0).toFixed(3) },
    { key: 'cw_price', header: 'CW', align: 'end',
      cell: (r) => r.cw_covered ? <span className="text-green-700 text-xs">✓</span> : Number(r.cw_price ?? 0).toFixed(3) },
    { key: 'cwc_price', header: 'CWC', align: 'end',
      cell: (r) => r.cwc_covered ? <span className="text-green-700 text-xs">✓</span> : Number(r.cwc_price ?? 0).toFixed(3) },
    { key: 'ug_price', header: 'UG', align: 'end',
      cell: (r) => r.ug_covered ? <span className="text-green-700 text-xs">✓</span> : Number(r.ug_price ?? 0).toFixed(3) },
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
                <Label required>{t('masters.servicesMaster')}</Label>
                <select
                  value={form.service_id}
                  onChange={(e) => setForm((s: any) => ({ ...s, service_id: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white"
                >
                  <option value="">—</option>
                  {props.services.map((s) => <option key={s.id} value={s.id}>{lbl(s)} ({s.service_code})</option>)}
                </select>
              </div>
              <div>
                <Label>{t('masters.machineCategories')}</Label>
                <select
                  value={form.machine_category_id ?? ''}
                  onChange={(e) => setForm((s: any) => ({ ...s, machine_category_id: e.target.value || null }))}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white"
                >
                  <option value="">— {t('common.all')} —</option>
                  {props.machineCategories.map((c) => <option key={c.id} value={c.id}>{lbl(c)}</option>)}
                </select>
              </div>
              <div>
                <Label>{t('masters.costPrice')}</Label>
                <Input type="number" step="0.001" value={form.cost_price}
                  onChange={(e) => setForm((s: any) => ({ ...s, cost_price: Number(e.target.value) }))} />
              </div>
              <div className="flex items-end gap-2 pb-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm((s: any) => ({ ...s, is_active: v }))} />
                <Label className="!mb-0">{t('common.active')}</Label>
              </div>
            </div>
            <div className="border-t pt-4">
              <div className="text-sm font-medium mb-2 text-gray-700">{t('masters.servicePricing')}</div>
              <div className="grid sm:grid-cols-3 gap-4">
                {TYPES.map((tt) => (
                  <div key={tt} className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                    <div className="text-xs uppercase font-mono text-gray-600 mb-2">{tt}</div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!!form[`${tt}_covered`]}
                          onCheckedChange={(v) => toggleCovered(tt, v)}
                          disabled={tt === 'ug'} // UG is always covered
                        />
                        <Label className="!mb-0 text-xs">{t('masters.covered')}</Label>
                      </div>
                      <Input
                        type="number" step="0.001" disabled={form[`${tt}_covered`]}
                        value={form[`${tt}_price`]}
                        onChange={(e) => setForm((s: any) => ({ ...s, [`${tt}_price`]: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
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
