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

export interface MasterField {
  name: string;
  label: string;
  required?: boolean;
  type?: 'text' | 'number' | 'select' | 'switch';
  dir?: 'ltr' | 'rtl';
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
}

export interface SimpleMasterClientProps<T extends { id: string; is_active?: boolean }> {
  title: string;
  rows: T[];
  total: number;
  columns: Column<T>[];
  fields: MasterField[];
  apiPath: string;
  canAdd: boolean;
  canEdit: boolean;
  defaultValues: Record<string, any>;
}

export function SimpleMasterClient<T extends { id: string; is_active?: boolean }>(
  props: SimpleMasterClientProps<T>
) {
  const { title, rows, total, columns, fields, apiPath, canAdd, canEdit, defaultValues } = props;
  const t = useTranslations();
  const router = useRouter();
  const [editing, setEditing] = useState<T | null>(null);
  const [creating, setCreating] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, any>>({ ...defaultValues });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setFormValues({ ...defaultValues });
    setError(null);
  };

  const openEdit = (row: T) => {
    setCreating(false);
    setEditing(row);
    setFormValues({ ...defaultValues, ...row });
    setError(null);
  };

  const close = () => {
    setCreating(false);
    setEditing(null);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const url = editing ? `${apiPath}/${editing.id}` : apiPath;
      const method = editing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }

      close();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const fullColumns: Column<T>[] = canEdit
    ? [
        ...columns,
        {
          key: '__actions',
          header: '',
          align: 'end',
          cell: (row) => (
            <button
              onClick={() => openEdit(row)}
              className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 text-sm"
            >
              <Pencil className="w-3.5 h-3.5" />
              {t('common.edit')}
            </button>
          ),
        },
      ]
    : columns;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>

      {(creating || editing) && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">
            {editing ? t('common.edit') : t('common.new')}
          </h2>

          <form onSubmit={submit} className="space-y-4">
            {error && <Alert variant="destructive">{error}</Alert>}

            <div className="grid sm:grid-cols-2 gap-4">
              {fields.map((f) => (
                <div key={f.name}>
                  <Label htmlFor={f.name} required={f.required}>
                    {f.label}
                  </Label>

                  {f.type === 'switch' ? (
                    <div className="pt-2">
                      <Switch
                        checked={!!formValues[f.name]}
                        onCheckedChange={(v) =>
                          setFormValues((s) => ({ ...s, [f.name]: v }))
                        }
                      />
                    </div>
                  ) : (
                    <Input
                      id={f.name}
                      type={f.type === 'number' ? 'number' : 'text'}
                      dir={f.dir}
                      placeholder={f.placeholder}
                      value={formValues[f.name] ?? ''}
                      onChange={(e) =>
                        setFormValues((s) => ({
                          ...s,
                          [f.name]: e.target.value,
                        }))
                      }
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? t('common.loading') : t('common.save')}
              </Button>

              <Button type="button" variant="outline" onClick={close}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <DataTable
        rows={rows}
        columns={fullColumns}
        total={total}
        page={1}
        pageSize={50}
        rightAction={
          canAdd && !creating && !editing ? (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 me-1" />
              {t('common.add')}
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}