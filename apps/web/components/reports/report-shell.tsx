'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { RefreshCw, Download, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface ReportColumn<T> {
  key: string;
  header: string;
  align?: 'start' | 'center' | 'end';
  /** How the cell renders. */
  cell: (row: T) => React.ReactNode;
  /** How the cell exports to CSV (defaults to text from cell). */
  csv?: (row: T) => string | number;
  hideOnMobile?: boolean;
}

interface Props<T> {
  title: string;
  rows: T[];
  columns: ReportColumn<T>[];
  /** If true, the report has date filters in the URL. */
  hasDateRange?: boolean;
  /** Initial values pulled from server-side. */
  fromDate?: string;
  toDate?: string;
  /** Snapshot reports show a small notice instead of date pickers. */
  isSnapshot?: boolean;
  /** Optional summary footer row (totals, averages) */
  summaryRow?: React.ReactNode;
}

const ISO = (d: Date) => d.toISOString().slice(0, 10);

function presetRange(preset: 'mtd' | 'last30' | 'qtd' | 'ytd' | 'last90'): { from: string; to: string } {
  const now = new Date();
  const today = ISO(now);
  if (preset === 'mtd') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: ISO(start), to: today };
  }
  if (preset === 'last30') {
    const start = new Date(); start.setDate(start.getDate() - 30);
    return { from: ISO(start), to: today };
  }
  if (preset === 'qtd') {
    const q = Math.floor(now.getMonth() / 3);
    const start = new Date(now.getFullYear(), q * 3, 1);
    return { from: ISO(start), to: today };
  }
  if (preset === 'ytd') {
    const start = new Date(now.getFullYear(), 0, 1);
    return { from: ISO(start), to: today };
  }
  // last90
  const start = new Date(); start.setDate(start.getDate() - 90);
  return { from: ISO(start), to: today };
}

/**
 * Convert rows to CSV. UTF-8 BOM is prepended so Excel-Arabic opens correctly.
 */
function rowsToCsv<T>(rows: T[], columns: ReportColumn<T>[]): string {
  const escapeCell = (v: any): string => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const headers = columns.map((c) => escapeCell(c.header)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => {
      if (c.csv) return escapeCell(c.csv(row));
      // Fall back to a string-ish version of the rendered cell.
      const cell = c.cell(row);
      const text = (typeof cell === 'string' || typeof cell === 'number') ? cell : '';
      return escapeCell(text);
    }).join(',')
  );
  return '\ufeff' + [headers, ...lines].join('\r\n');
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReportShell<T>({
  title, rows, columns, hasDateRange = false, fromDate, toDate, isSnapshot = false, summaryRow,
}: Props<T>) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [from, setFrom] = useState(fromDate ?? '');
  const [to, setTo] = useState(toDate ?? '');

  const apply = () => {
    if (hasDateRange && from && to) {
      const params = new URLSearchParams(search.toString());
      params.set('from_date', from);
      params.set('to_date', to);
      startTransition(() => router.push(`?${params.toString()}`));
    } else {
      startTransition(() => router.refresh());
    }
  };

  const usePreset = (p: 'mtd' | 'last30' | 'qtd' | 'ytd' | 'last90') => {
    const { from: f, to: tt } = presetRange(p);
    setFrom(f);
    setTo(tt);
    if (hasDateRange) {
      const params = new URLSearchParams(search.toString());
      params.set('from_date', f);
      params.set('to_date', tt);
      startTransition(() => router.push(`?${params.toString()}`));
    }
  };

  const exportCsv = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `${title.toLowerCase().replace(/\s+/g, '-')}-${stamp}.csv`;
    downloadCsv(filename, rowsToCsv(rows, columns));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={apply} disabled={pending}>
            <RefreshCw className={`w-4 h-4 me-1 ${pending ? 'animate-spin' : ''}`} />
            {t('reports.refresh')}
          </Button>
          <Button variant="default" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="w-4 h-4 me-1" />
            {t('reports.exportCsv')}
          </Button>
        </div>
      </div>

      <Card className="p-4">
        {hasDateRange ? (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-3 items-end">
              <div>
                <Label htmlFor="from">{t('reports.fromDate')}</Label>
                <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr" />
              </div>
              <div>
                <Label htmlFor="to">{t('reports.toDate')}</Label>
                <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" />
              </div>
              <Button onClick={apply} disabled={!from || !to || pending}>
                <Calendar className="w-4 h-4 me-1" />
                {t('reports.refresh')}
              </Button>
            </div>
            <div className="flex items-center gap-1 flex-wrap pt-1">
              {(['mtd','last30','qtd','last90','ytd'] as const).map((p) => (
                <button key={p} onClick={() => usePreset(p)}
                  className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200">
                  {t(`reports.presets.${p}`)}
                </button>
              ))}
            </div>
          </div>
        ) : isSnapshot ? (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4 text-gray-400" />
            {t('reports.snapshot')}
          </div>
        ) : null}
      </Card>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500 p-8 text-center">{t('reports.noRows')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-200">
                  {columns.map((c) => (
                    <th key={c.key}
                        className={`px-4 py-2.5 font-medium text-gray-700 text-${c.align ?? 'start'} ${c.hideOnMobile ? 'hidden md:table-cell' : ''}`}>
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                    {columns.map((c) => (
                      <td key={c.key}
                          className={`px-4 py-2.5 text-${c.align ?? 'start'} ${c.hideOnMobile ? 'hidden md:table-cell' : ''}`}>
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {summaryRow && (
                <tfoot className="bg-gray-50 font-semibold">
                  {summaryRow}
                </tfoot>
              )}
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/** Format a numeric value as KWD with 3 decimals. */
export function fmtKwd(n: number, locale: string = 'en-US'): string {
  // Use English numerals for accounting clarity even in Arabic locale
  return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

/** Format an integer */
export function fmtInt(n: number, locale: string = 'en-US'): string {
  return n.toLocaleString(locale === 'ar' ? 'ar-KW' : 'en-US');
}
