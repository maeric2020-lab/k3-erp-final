'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { DataTable, type Column } from '@/components/ui/data-table';
import type { ImportRun } from '@k3/repositories';

const TEMPLATES = [
  'auto', 'customers', 'machines', 'services', 'parts',
  'gas', 'service_pricing', 'contract_pricing',
] as const;

interface Props {
  title: string;
  history: ImportRun[];
  canImport: boolean;
}

interface PreviewRow {
  id: string;
  row_number: number;
  raw_data: Record<string, any>;
  resolved_data: any;
  validation_errors: Array<{ field: string; message: string }>;
  action: 'pending' | 'insert' | 'update' | 'skip' | 'error';
  target_table: string | null;
}

export function ImportsClient(props: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [template, setTemplate] = useState<string>('auto');
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewRunId, setPreviewRunId] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [committedTemplate, setCommittedTemplate] = useState<string | null>(null);

  const downloadTemplate = async (key: string) => {
    if (key === 'auto') return;
    setError(null);
    try {
      const res = await fetch(`/api/imports/templates/${key}`);
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('content-disposition') ?? '';
      const m = /filename="?([^"]+)"?/.exec(cd);
      a.download = m?.[1] ?? `${key}_template.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onUpload = async () => {
    if (!file) { setError(t('imports.noFile')); return; }
    if (file.size > 25 * 1024 * 1024) { setError(t('imports.fileTooLarge')); return; }
    setError(null); setSuccess(null);
    setRunning(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('template', template);
      const res = await fetch('/api/imports/preview', { method: 'POST', body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      const body = await res.json();
      setPreviewRunId(body.run.id);
      setPreviewRows(body.rows ?? []);
      setCommittedTemplate(body.run.template_type);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const commit = async () => {
    if (!previewRunId) return;
    setError(null);
    setRunning(true);
    try {
      const res = await fetch('/api/imports/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: previewRunId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      const body = await res.json();
      setSuccess(`${t('imports.successCommit')}: +${body.inserted} / ~${body.updated} / -${body.skipped} / ✗${body.failed}`);
      setPreviewRunId(null); setPreviewRows([]); setFile(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const cancel = async () => {
    if (!previewRunId) return;
    await fetch('/api/imports/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: previewRunId }),
    });
    setPreviewRunId(null); setPreviewRows([]);
    router.refresh();
  };

  const counts = previewRows.reduce(
    (a, r) => ({
      total: a.total + 1,
      insert: a.insert + (r.action === 'insert' ? 1 : 0),
      update: a.update + (r.action === 'update' ? 1 : 0),
      skip: a.skip + (r.action === 'skip' ? 1 : 0),
      error: a.error + (r.action === 'error' ? 1 : 0),
    }),
    { total: 0, insert: 0, update: 0, skip: 0, error: 0 }
  );

  const previewColumns: Column<PreviewRow>[] = [
    { key: 'row_number', header: t('imports.rowNumber'), className: 'w-16 font-mono text-xs' },
    {
      key: 'action',
      header: t('imports.action'),
      cell: (r) => {
        const map: Record<string, string> = {
          insert: 'bg-blue-50 text-blue-700',
          update: 'bg-amber-50 text-amber-700',
          skip: 'bg-gray-50 text-gray-600',
          error: 'bg-red-50 text-red-700',
        };
        return (
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${map[r.action] ?? ''}`}>
            {t(`imports.actions.${r.action === 'pending' ? 'skip' : r.action}` as any)}
          </span>
        );
      },
    },
    {
      key: 'errors',
      header: t('imports.errors'),
      cell: (r) =>
        r.validation_errors.length > 0 ? (
          <div className="text-xs text-red-700 space-y-0.5">
            {r.validation_errors.map((e, i) => (
              <div key={i}><strong>{e.field}:</strong> {e.message}</div>
            ))}
          </div>
        ) : <span className="text-xs text-gray-400">—</span>,
    },
    {
      key: 'raw_data',
      header: t('common.details'),
      cell: (r) => (
        <code className="text-xs text-gray-600 line-clamp-1">
          {JSON.stringify(r.raw_data).slice(0, 120)}
        </code>
      ),
    },
  ];

  const historyColumns: Column<ImportRun>[] = [
    { key: 'started_at', header: t('imports.committedAt'), className: 'w-44',
      cell: (r) => new Date(r.started_at).toLocaleString() },
    { key: 'template_type', header: t('imports.templateType'),
      cell: (r) => t(`imports.templates.${r.template_type}` as any) ?? r.template_type },
    { key: 'source_filename', header: t('imports.filename'),
      cell: (r) => <span className="font-mono text-xs">{r.source_filename ?? '—'}</span> },
    { key: 'inserted_rows', header: '+',  align: 'center' },
    { key: 'updated_rows',  header: '~',  align: 'center' },
    { key: 'skipped_rows',  header: '-',  align: 'center' },
    { key: 'failed_rows',   header: '✗',  align: 'center' },
    { key: 'status', header: t('imports.status'), align: 'center',
      cell: (r) => {
        const cls = r.status === 'committed' ? 'bg-green-50 text-green-700'
          : r.status === 'failed' ? 'bg-red-50 text-red-700'
          : r.status === 'cancelled' ? 'bg-gray-50 text-gray-500'
          : 'bg-amber-50 text-amber-700';
        return <span className={`px-2 py-0.5 rounded-full text-xs ${cls}`}>{t(`imports.statuses.${r.status}` as any)}</span>;
      },
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900">{props.title}</h1>

      {error && <Alert variant="destructive">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {props.canImport && !previewRunId && (
        <Card className="p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>{t('imports.templateType')}</Label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white"
              >
                {TEMPLATES.map((tt) => (
                  <option key={tt} value={tt}>{t(`imports.templates.${tt}` as any)}</option>
                ))}
              </select>
              {template !== 'auto' && (
                <button
                  type="button"
                  onClick={() => downloadTemplate(template)}
                  className="mt-2 text-xs text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  {t('imports.downloadTemplate')}
                </button>
              )}
            </div>
            <div>
              <Label>{t('imports.uploadFile')}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".xlsx,.xlsm,.xls,.csv"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-700 file:me-3 file:py-2 file:px-4 file:rounded file:border-0 file:bg-brand-600 file:text-white hover:file:bg-brand-700 file:cursor-pointer"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={onUpload} disabled={running || !file}>
              <Upload className="w-4 h-4 me-1" />
              {running ? t('common.loading') : t('imports.preview')}
            </Button>
          </div>
        </Card>
      )}

      {previewRunId && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-brand-600" />
              {t('imports.preview')}
              <span className="text-sm text-gray-500 font-normal">
                ({committedTemplate && t(`imports.templates.${committedTemplate}` as any)})
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <Button onClick={commit} disabled={running || counts.insert + counts.update === 0}>
                <CheckCircle className="w-4 h-4 me-1" />
                {t('imports.commit')}
              </Button>
              <Button variant="outline" onClick={cancel} disabled={running}>
                <XCircle className="w-4 h-4 me-1" />
                {t('imports.cancel')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <Stat label={t('imports.totalRows')} value={counts.total} tone="default" />
            <Stat label={t('imports.willInsert')} value={counts.insert} tone="blue" />
            <Stat label={t('imports.willUpdate')} value={counts.update} tone="amber" />
            <Stat label={t('imports.willSkip')} value={counts.skip} tone="gray" />
            <Stat label={t('imports.errors')} value={counts.error} tone="red" />
          </div>
          <DataTable rows={previewRows} columns={previewColumns} pageSize={500} />
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">{t('imports.history')}</h2>
        <DataTable rows={props.history} columns={historyColumns} pageSize={25} />
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'default' | 'blue' | 'amber' | 'gray' | 'red' }) {
  const toneClass: Record<string, string> = {
    default: 'bg-gray-50 text-gray-900',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    gray: 'bg-gray-50 text-gray-500',
    red: 'bg-red-50 text-red-700',
  };
  return (
    <div className={`rounded-lg border border-gray-200 p-3 ${toneClass[tone]}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}
