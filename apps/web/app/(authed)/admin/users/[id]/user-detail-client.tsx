'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert } from '@/components/ui/alert';
import { PermissionGrid } from '@/components/admin/permission-grid';
import type { UserProfile, PermissionGridRow, PermissionTemplate } from '@k3/repositories';

interface Props {
  profile: UserProfile;
  initialGrid: PermissionGridRow[];
  templates: PermissionTemplate[];
  canEdit: boolean;
}

export function UserDetailClient({ profile: initialProfile, initialGrid, templates, canEdit }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [form, setForm] = useState({
    full_name_ar: profile.full_name_ar,
    full_name_en: profile.full_name_en ?? '',
    phone: profile.phone ?? '',
    technician_code: profile.technician_code ?? '',
    is_super_admin: profile.is_super_admin,
    is_active: profile.is_active,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [templateId, setTemplateId] = useState('');
  const [templateMode, setTemplateMode] = useState<'merge' | 'replace'>('merge');
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [grid, setGrid] = useState(initialGrid);

  const saveProfile = async () => {
    setSavingProfile(true);
    setProfileError(null);
    try {
      const res = await fetch(`/api/admin/users/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      // Refresh profile from server
      const r = await fetch(`/api/admin/users/${profile.id}`).then((r) => r.json());
      setProfile(r);
      router.refresh();
    } catch (e) {
      setProfileError((e as Error).message);
    } finally {
      setSavingProfile(false);
    }
  };

  const onToggleGrant = async (screenCode: string, action: string, granted: boolean) => {
    const res = await fetch(`/api/admin/users/${profile.id}/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screen_code: screenCode, action, granted }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `${res.status}`);
    }
  };

  const applyTemplate = async () => {
    if (!templateId) return;
    setApplyingTemplate(true);
    setTemplateError(null);
    try {
      const res = await fetch(`/api/admin/users/${profile.id}/apply-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateId, replace: templateMode === 'replace' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      // Refresh grid
      const g = await fetch(`/api/admin/users/${profile.id}/permissions`).then((r) => r.json());
      setGrid(g.grid ?? []);
      setTemplateId('');
    } catch (e) {
      setTemplateError((e as Error).message);
    } finally {
      setApplyingTemplate(false);
    }
  };

  return (
    <>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            {profile.is_super_admin && <ShieldCheck className="w-6 h-6 text-brand-600" />}
            <span dir="auto">{locale === 'ar' ? profile.full_name_ar : (profile.full_name_en || profile.full_name_ar)}</span>
          </h1>
          <div className="text-sm text-gray-500 font-mono" dir="ltr">{profile.email}</div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs ${
          !profile.is_active ? 'bg-gray-100 text-gray-500' :
          profile.is_super_admin ? 'bg-brand-50 text-brand-700' : 'bg-green-50 text-green-700'
        }`}>
          {!profile.is_active ? t('common.inactive') :
           profile.is_super_admin ? t('admin.users.isSuperAdmin') : t('admin.users.roleStaff')}
        </span>
      </div>

      {/* Profile editor */}
      <Card className="p-6 space-y-4">
        <h2 className="font-semibold">{t('common.details')}</h2>
        {profileError && <Alert variant="destructive">{profileError}</Alert>}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="full_name_ar" required>{t('common.name_ar')}</Label>
            <Input id="full_name_ar" value={form.full_name_ar}
              onChange={(e) => setForm((s) => ({ ...s, full_name_ar: e.target.value }))}
              dir="rtl" disabled={!canEdit} />
          </div>
          <div>
            <Label htmlFor="full_name_en">{t('common.name_en')}</Label>
            <Input id="full_name_en" value={form.full_name_en}
              onChange={(e) => setForm((s) => ({ ...s, full_name_en: e.target.value }))}
              dir="ltr" disabled={!canEdit} />
          </div>
          <div>
            <Label htmlFor="phone">{t('admin.users.phone')}</Label>
            <Input id="phone" value={form.phone}
              onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
              dir="ltr" disabled={!canEdit} />
          </div>
          <div>
            <Label htmlFor="technician_code">{t('admin.users.technicianId')}</Label>
            <Input id="technician_code" value={form.technician_code}
              onChange={(e) => setForm((s) => ({ ...s, technician_code: e.target.value }))}
              dir="ltr" disabled={!canEdit} />
          </div>
        </div>
        <div className="flex items-center gap-6 pt-2">
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm((s) => ({ ...s, is_active: v }))} disabled={!canEdit} />
            <Label className="!mb-0">{form.is_active ? t('common.active') : t('common.inactive')}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_super_admin} onCheckedChange={(v) => setForm((s) => ({ ...s, is_super_admin: v }))} disabled={!canEdit} />
            <Label className="!mb-0">{t('admin.users.isSuperAdmin')}</Label>
          </div>
        </div>
        {canEdit && (
          <div>
            <Button onClick={saveProfile} disabled={savingProfile}>
              {savingProfile ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        )}
      </Card>

      {/* Apply template */}
      {canEdit && templates.length > 0 && !profile.is_super_admin && (
        <Card className="p-6 space-y-3">
          <h2 className="font-semibold">{t('admin.users.applyTemplate')}</h2>
          {templateError && <Alert variant="destructive">{templateError}</Alert>}
          <div className="grid sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2">
              <Label htmlFor="template">{t('admin.permissionTemplates.title')}</Label>
              <select id="template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                <option value="">—</option>
                {templates.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>{tmpl.name}{tmpl.description ? ` — ${tmpl.description}` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Mode</Label>
              <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-white p-1">
                <Button size="sm" variant={templateMode === 'merge' ? 'default' : 'ghost'}
                  onClick={() => setTemplateMode('merge')} className="flex-1">
                  {t('admin.users.applyTemplateMerge')}
                </Button>
                <Button size="sm" variant={templateMode === 'replace' ? 'default' : 'ghost'}
                  onClick={() => setTemplateMode('replace')} className="flex-1">
                  {t('admin.users.applyTemplateReplace')}
                </Button>
              </div>
            </div>
          </div>
          <Button onClick={applyTemplate} disabled={!templateId || applyingTemplate}>
            {applyingTemplate ? t('common.loading') : t('admin.users.applyTemplate')}
          </Button>
        </Card>
      )}

      {/* Permission grid */}
      {profile.is_super_admin ? (
        <Card className="p-6">
          <div className="flex items-center gap-2 text-brand-700">
            <ShieldCheck className="w-5 h-5" />
            <p className="text-sm">
              Super-admins automatically have all permissions on every screen. Use the toggle above to demote.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <h2 className="font-semibold mb-3">{t('admin.users.permissionsGrid')}</h2>
          <PermissionGrid initialGrid={grid} onToggle={onToggleGrant} readOnly={!canEdit} />
        </Card>
      )}
    </>
  );
}
