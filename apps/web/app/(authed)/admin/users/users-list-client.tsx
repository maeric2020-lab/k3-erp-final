'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Plus, Shield, ShieldCheck, Power, PowerOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Alert } from '@/components/ui/alert';
import type { UserProfile } from '@k3/repositories';

interface Props {
  initialRows: UserProfile[];
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export function UsersListClient({ initialRows, canAdd, canEdit, canDelete }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = search
    ? rows.filter((u) =>
        (u.full_name_ar ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (u.full_name_en ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (u.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (u.technician_code ?? '').toLowerCase().includes(search.toLowerCase()))
    : rows;

  const refresh = async () => {
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      const j = await res.json();
      setRows(j.rows ?? []);
    }
    router.refresh();
  };

  const setActive = async (id: string, active: boolean) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}/active`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const archive = async (id: string) => {
    if (!confirm(t('common.deleteConfirm'))) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const columns: Column<UserProfile>[] = [
    {
      key: 'full_name_ar', header: t('admin.users.fullName'),
      cell: (r) => (
        <div className="flex items-center gap-2">
          {r.is_super_admin && <ShieldCheck className="w-4 h-4 text-brand-600 flex-shrink-0" />}
          <Link href={`/admin/users/${r.id}`} className="text-brand-600 hover:underline" dir="auto">
            {locale === 'ar' ? r.full_name_ar : (r.full_name_en || r.full_name_ar)}
          </Link>
        </div>
      ),
    },
    { key: 'email', header: t('admin.users.email'),
      cell: (r) => <span className="font-mono text-xs" dir="ltr">{r.email}</span> },
    { key: 'technician_code', header: t('admin.users.technicianId'), align: 'center', hideOnMobile: true,
      cell: (r) => r.technician_code ? <span className="font-mono text-xs">{r.technician_code}</span> : '—' },
    { key: 'phone', header: t('admin.users.phone'), hideOnMobile: true,
      cell: (r) => r.phone ? <span className="font-mono text-xs" dir="ltr">{r.phone}</span> : '—' },
    { key: 'is_active', header: t('common.status'), align: 'center',
      cell: (r) => (
        <span className={`px-2 py-0.5 rounded-full text-xs ${
          !r.is_active ? 'bg-gray-100 text-gray-500' :
          r.is_super_admin ? 'bg-brand-50 text-brand-700' : 'bg-green-50 text-green-700'
        }`}>
          {!r.is_active ? t('common.inactive') :
           r.is_super_admin ? t('admin.users.isSuperAdmin') : t('admin.users.roleStaff')}
        </span>
      ),
    },
    ...(canEdit || canDelete ? [{
      key: 'actions' as keyof UserProfile, header: '', align: 'end' as const,
      cell: (r: UserProfile) => (
        <div className="flex items-center justify-end gap-1">
          {canEdit && (
            <button
              onClick={() => setActive(r.id, !r.is_active)}
              disabled={busyId === r.id}
              title={r.is_active ? t('admin.users.deactivate') : t('admin.users.activate')}
              className={`p-1.5 rounded ${r.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}`}
            >
              {r.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
            </button>
          )}
          {canDelete && !r.is_super_admin && (
            <button
              onClick={() => archive(r.id)}
              disabled={busyId === r.id}
              title={t('admin.users.archive')}
              className="p-1.5 rounded text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    }] : []),
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <Shield className="w-6 h-6 text-gray-400" />
        {t('admin.users.title')}
      </h1>
      {error && <Alert variant="destructive">{error}</Alert>}
      <DataTable
        rows={filtered}
        columns={columns}
        total={rows.length}
        page={page}
        pageSize={50}
        onPageChange={setPage}
        onSearch={setSearch}
        searchValue={search}
        rightAction={canAdd && (
          <Link href="/admin/users/new">
            <Button><Plus className="w-4 h-4 me-1" />{t('admin.users.newUser')}</Button>
          </Link>
        )}
      />
    </div>
  );
}
