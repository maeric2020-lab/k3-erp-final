'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Pencil, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert } from '@/components/ui/alert';
import type { ContractClauseTemplate } from '@k3/repositories';

const CONTRACT_TYPES = ['CO', 'CW', 'CWC'] as const;

interface Props {
  initialRows: ContractClauseTemplate[];
  total: number;
  canAdd: boolean;
  canEdit: boolean;
}

interface FormState {
  code: string;
  display_order: number;
  title_ar: string;
  title_en: string;
  body_ar: string;
  body_en: string;
  applies_to: string[];
  is_active: boolean;
}

const EMPTY: FormState = {
  code: '', display_order: 0, title_ar: '', title_en: '',
  body_ar: '', body_en: '', applies_to: [], is_active: true,
};

export function ClauseTemplatesClient({ initialRows, canAdd, canEdit }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [editing, setEditing] = useState<ContractClauseTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startCreate = () => {
    setForm(EMPTY);
    setEditing(null);
    setCreating(true);
    setError(null);
  };
  const startEdit = (row: ContractClauseTemplate) => {
    setForm({
      code: row.code,
      display_order: row.display_order,
      title_ar: row.title_ar,
      title_en: row.title_en,
      body_ar: row.body_ar,
      body_en: row.body_en,
      applies_to: row.applies_to ?? [],
      is_active: row.is_active,
    });
    setEditing(row);
    setCreating(false);
    setError(null);
  };
  const cancel = () => { setEditing(null); setCreating(false); setForm(EMPTY); setError(null); };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const url = editing ? `/api/admin/contract-clause-templates/${editing.id}` : '/api/admin/contract-clause-templates';
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      cancel();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleAppliesTo = (type: string) => {
    setForm((s) => ({
      ...s,
      applies_to: s.applies_to.includes(type) ? s.applies_to.filter((x) => x !== type) : [...s.applies_to, type],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('finance.contractClauseTemplates.title')}</h1>
        {canAdd && !creating && !editing && (
          <Button onClick={startCreate}><Plus className="w-4 h-4 me-1" />{t('common.add')}</Button>
        )}
      </div>

      {(creating || editing) && (
        <Card className="p-6 space-y-4">
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="code" required>{t('finance.contractClauseTemplates.code')}</Label>
              <Input id="code" value={form.code} onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <Label htmlFor="display_order">{t('finance.contractClauseTemplates.displayOrder')}</Label>
              <Input id="display_order" type="number" value={form.display_order}
                onChange={(e) => setForm((s) => ({ ...s, display_order: Number(e.target.value) || 0 }))} dir="ltr" />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm((s) => ({ ...s, is_active: v }))} />
              <Label className="!mb-0">{form.is_active ? t('common.active') : t('common.inactive')}</Label>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title_ar" required>{t('finance.contractClauseTemplates.titleAr')}</Label>
              <Input id="title_ar" value={form.title_ar} onChange={(e) => setForm((s) => ({ ...s, title_ar: e.target.value }))} dir="rtl" />
            </div>
            <div>
              <Label htmlFor="title_en" required>{t('finance.contractClauseTemplates.titleEn')}</Label>
              <Input id="title_en" value={form.title_en} onChange={(e) => setForm((s) => ({ ...s, title_en: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <Label htmlFor="body_ar" required>{t('finance.contractClauseTemplates.bodyAr')}</Label>
              <textarea id="body_ar" value={form.body_ar} onChange={(e) => setForm((s) => ({ ...s, body_ar: e.target.value }))}
                dir="rtl" className="w-full min-h-[140px] px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white" />
            </div>
            <div>
              <Label htmlFor="body_en" required>{t('finance.contractClauseTemplates.bodyEn')}</Label>
              <textarea id="body_en" value={form.body_en} onChange={(e) => setForm((s) => ({ ...s, body_en: e.target.value }))}
                dir="ltr" className="w-full min-h-[140px] px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white" />
            </div>
          </div>
          <div>
            <Label>{t('finance.contractClauseTemplates.appliesTo')}</Label>
            <div className="flex items-center gap-2 flex-wrap">
              {CONTRACT_TYPES.map((tp) => (
                <button
                  key={tp} type="button" onClick={() => toggleAppliesTo(tp)}
                  className={`px-3 py-1.5 rounded-md border text-sm font-mono ${form.applies_to.includes(tp) ? 'bg-brand-50 text-brand-700 border-brand-300' : 'bg-white text-gray-600 border-gray-300'}`}
                >{tp}</button>
              ))}
              <span className="text-xs text-gray-500">— empty = applies to all types</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={submit} disabled={busy}>{busy ? t('common.loading') : t('common.save')}</Button>
            <Button variant="outline" onClick={cancel}>{t('common.cancel')}</Button>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {initialRows.map((row) => (
          <Card key={row.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100">{row.code}</span>
                  <span className="font-semibold" dir="rtl">{row.title_ar}</span>
                  <span className="text-gray-500 text-sm" dir="ltr">· {row.title_en}</span>
                  <span className="text-xs text-gray-400">#{row.display_order}</span>
                  {row.applies_to.length > 0 && (
                    <span className="text-xs text-gray-500">[{row.applies_to.join(', ')}]</span>
                  )}
                  {!row.is_active && <span className="px-1.5 py-0.5 rounded bg-gray-200 text-xs">{t('common.inactive')}</span>}
                </div>
                <p className="mt-1 text-sm text-gray-700 line-clamp-2 whitespace-pre-wrap" dir="rtl">{row.body_ar}</p>
              </div>
              {canEdit && (
                <button onClick={() => startEdit(row)} className="p-1.5 rounded text-gray-500 hover:bg-gray-100">
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
