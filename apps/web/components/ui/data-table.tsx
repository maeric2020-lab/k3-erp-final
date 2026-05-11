'use client';

import { useState, useMemo, type ReactNode } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Render the cell. Defaults to (row[key] as string). */
  cell?: (row: T) => ReactNode;
  /** Tailwind class for the header & cell, e.g. 'w-32' */
  className?: string;
  /** If true, hidden on small screens */
  hideOnMobile?: boolean;
  align?: 'start' | 'center' | 'end';
}

export interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onSearch?: (q: string) => void;
  searchValue?: string;
  searchPlaceholder?: string;
  isLoading?: boolean;
  emptyMessage?: string;
  rowKey?: (row: T) => string;
  /** Optional action element rendered above the table on the right */
  rightAction?: ReactNode;
  /** Optional row click handler */
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends Record<string, any>>({
  rows,
  columns,
  total,
  page = 1,
  pageSize = 25,
  onPageChange,
  onSearch,
  searchValue,
  searchPlaceholder,
  isLoading = false,
  emptyMessage,
  rowKey,
  rightAction,
  onRowClick,
}: DataTableProps<T>) {
  const t = useTranslations('common');
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const [localSearch, setLocalSearch] = useState(searchValue ?? '');

  const safeTotal = total ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(safeTotal / pageSize));
  const from = safeTotal === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, safeTotal);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(localSearch.trim());
  };

  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        {onSearch && (
          <form onSubmit={handleSearchSubmit} className="relative max-w-sm w-full">
            <Search className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} w-4 h-4 text-gray-400 pointer-events-none`} />
            <Input
              type="search"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder={searchPlaceholder ?? t('search')}
              className={isRtl ? 'pr-9' : 'pl-9'}
            />
          </form>
        )}
        {rightAction && <div>{rightAction}</div>}
      </div>

      <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-3 py-2.5 font-medium text-gray-700 ${
                      col.align === 'center' ? 'text-center' : col.align === 'end' ? (isRtl ? 'text-left' : 'text-right') : isRtl ? 'text-right' : 'text-left'
                    } ${col.hideOnMobile ? 'hidden md:table-cell' : ''} ${col.className ?? ''}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={columns.length} className="px-3 py-12 text-center text-gray-500">{t('loading')}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={columns.length} className="px-3 py-12 text-center text-gray-500">{emptyMessage ?? t('noResults')}</td></tr>
              ) : (
                rows.map((row, idx) => (
                  <tr
                    key={rowKey ? rowKey(row) : (row.id ?? idx)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`border-b border-gray-100 last:border-b-0 ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-3 py-2.5 ${
                          col.align === 'center' ? 'text-center' : col.align === 'end' ? (isRtl ? 'text-left' : 'text-right') : isRtl ? 'text-right' : 'text-left'
                        } ${col.hideOnMobile ? 'hidden md:table-cell' : ''} ${col.className ?? ''}`}
                      >
                        {col.cell ? col.cell(row) : <span>{row[col.key] ?? '—'}</span>}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {onPageChange && safeTotal > 0 && (
          <div className="flex items-center justify-between px-3 py-2.5 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
            <div>
              {from}–{to} {t('of')} {safeTotal}
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                aria-label={t('previous')}
              >
                <PrevIcon className="w-4 h-4" />
              </Button>
              <span>
                {t('page')} {page} {t('of')} {totalPages}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                aria-label={t('next')}
              >
                <NextIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
