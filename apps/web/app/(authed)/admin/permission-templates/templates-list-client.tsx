'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Pencil, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert } from '@/components/ui/alert';
import type { PermissionTemplate } from '@k3/repositories';

interface Props {
  initialRows: PermissionTemplate[];
  total: number;
  canAdd: boolean;
  canEdit: boolean;
}

export function TemplatesListClient({ initialRows, canAdd, canEdit }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', is_active: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/permission-templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      const body = await res.json();
      router.push(`/admin/permission-templates/${body.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.permissionTemplates.title')}</h1>
        {canAdd && !creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 me-1" />{t('admin.permissionTemplates.newTemplate')}
          </Button>
        )}
      </div>

      {creating && (
        <Card className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t('admin.permissionTemplates.newTemplate')}</h2>
            <button onClick={() => setCreating(false)} className="p-1 rounded hover:bg-gray-100"><X className="w-4 h-4" /></button>
          </div>
          {error && <Alert variant="destructive">{error}</Alert>}
          <div>
            <Label htmlFor="name" required>{t('admin.permissionTemplates.name')}</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} dir="auto" />
          </div>
          <div>
            <Label htmlFor="description">{t('admin.permissionTemplates.description')}</Label>
            <Input id="description" value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} dir="auto" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm((s) => ({ ...s, is_active: v }))} />
            <Label className="!mb-0">{form.is_active ? t('common.active') : t('common.inactive')}</Label>
          </div>
          <Button onClick={submitCreate} disabled={busy || !form.name.trim()}>
            {busy ? t('common.loading') : t('common.save')}
          </Button>
        </Card>
      )}

      <div className="space-y-2">
        {initialRows.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">{t('common.noData')}</p>
        ) : (
          initialRows.map((tpl) => (
            <Card key={tpl.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold flex items-center gap-2">
                    <Link href={`/admin/permission-templates/${tpl.id}`} className="text-brand-600 hover:underline">
                      {tpl.name}
                    </Link>
                    {!tpl.is_active && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">{t('common.inactive')}</span>}
                  </div>
                  {tpl.description && <p className="text-sm text-gray-500 mt-1">{tpl.description}</p>}
                </div>
                {canEdit && (
                  <Link href={`/admin/permission-templates/${tpl.id}`} className="p-1.5 rounded text-gray-500 hover:bg-gray-100">
                    <Pencil className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
