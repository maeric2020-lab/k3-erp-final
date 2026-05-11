'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert } from '@/components/ui/alert';
import { PermissionGrid } from '@/components/admin/permission-grid';
import type { PermissionTemplate, PermissionGridRow } from '@k3/repositories';

interface Props {
  template: PermissionTemplate;
  initialGrid: PermissionGridRow[];
  canEdit: boolean;
}

export function TemplateDetailClient({ template: initialTemplate, initialGrid, canEdit }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [template, setTemplate] = useState(initialTemplate);
  const [form, setForm] = useState({
    name: template.name,
    description: template.description ?? '',
    is_active: template.is_active,
  });
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const saveMeta = async () => {
    setSavingMeta(true);
    setMetaError(null);
    try {
      const res = await fetch(`/api/admin/permission-templates/${template.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      setTemplate((p) => ({ ...p, ...form } as any));
      router.refresh();
    } catch (e) {
      setMetaError((e as Error).message);
    } finally {
      setSavingMeta(false);
    }
  };

  const onToggleItem = async (screenCode: string, action: string, granted: boolean) => {
    // Use single-item upsert by replacing the items list. Since we don't expose
    // a single-item endpoint, we use replaceItems via PUT.
    // To avoid round-tripping the whole grid, we'll fetch current items, mutate,
    // and PUT.
    const currentRes = await fetch(`/api/admin/permission-templates/${template.id}/items`);
    const current = await currentRes.json();
    const items: Array<{ screen_code: string; action: string }> =
      (current.items ?? []).map((i: any) => ({ screen_code: i.screen_code, action: i.action }));

    if (granted) {
      if (!items.some((i) => i.screen_code === screenCode && i.action === action)) {
        items.push({ screen_code: screenCode, action });
      }
    } else {
      const idx = items.findIndex((i) => i.screen_code === screenCode && i.action === action);
      if (idx >= 0) items.splice(idx, 1);
    }

    const res = await fetch(`/api/admin/permission-templates/${template.id}/items`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `${res.status}`);
    }
  };

  const remove = async () => {
    if (!confirm(t('common.deleteConfirm'))) return;
    setDeleting(true);
    setMetaError(null);
    try {
      const res = await fetch(`/api/admin/permission-templates/${template.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      router.push('/admin/permission-templates');
    } catch (e) {
      setMetaError((e as Error).message);
      setDeleting(false);
    }
  };

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{template.name}</h1>
        {template.description && <p className="text-sm text-gray-500 mt-1">{template.description}</p>}
      </div>

      {/* Meta editor */}
      <Card className="p-6 space-y-3">
        <h2 className="font-semibold">{t('common.details')}</h2>
        {metaError && <Alert variant="destructive">{metaError}</Alert>}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name" required>{t('admin.permissionTemplates.name')}</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              dir="auto" disabled={!canEdit} />
          </div>
          <div>
            <Label htmlFor="description">{t('admin.permissionTemplates.description')}</Label>
            <Input id="description" value={form.description}
              onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
              dir="auto" disabled={!canEdit} />
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Switch checked={form.is_active} onCheckedChange={(v) => setForm((s) => ({ ...s, is_active: v }))} disabled={!canEdit} />
          <Label className="!mb-0">{form.is_active ? t('common.active') : t('common.inactive')}</Label>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 pt-2">
            <Button onClick={saveMeta} disabled={savingMeta}>
              {savingMeta ? t('common.loading') : t('common.save')}
            </Button>
            <Button variant="outline" onClick={remove} disabled={deleting} className="text-red-600 hover:bg-red-50">
              {t('common.delete')}
            </Button>
          </div>
        )}
      </Card>

      {/* Items grid */}
      <Card className="p-6">
        <h2 className="font-semibold mb-3">{t('admin.permissionTemplates.items')}</h2>
        <PermissionGrid initialGrid={initialGrid} onToggle={onToggleItem} readOnly={!canEdit} />
      </Card>
    </>
  );
}
