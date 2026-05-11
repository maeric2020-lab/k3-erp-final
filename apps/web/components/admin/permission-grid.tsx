'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Check } from 'lucide-react';
import type { PermissionGridRow } from '@k3/repositories';

interface PermissionCell {
  screen_code: string;
  module: string;
  label_ar: string;
  label_en: string;
  display_order: number;
  action: string;
  granted: boolean;
}

interface Props {
  initialGrid: PermissionGridRow[];
  /** Called when a single cell toggles. Should persist and resolve. */
  onToggle: (screenCode: string, action: string, granted: boolean) => Promise<void>;
  readOnly?: boolean;
}

const ALL_ACTIONS = ['view','add','edit','delete','print','export','approve','assign','import'] as const;

export function PermissionGrid({ initialGrid, onToggle, readOnly = false }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const [grid, setGrid] = useState<PermissionCell[]>(initialGrid);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Group by module → screen
  const grouped = useMemo(() => {
    const byModule = new Map<string, Map<string, PermissionCell[]>>();
    for (const row of grid) {
      if (!byModule.has(row.module)) byModule.set(row.module, new Map());
      const byScreen = byModule.get(row.module)!;
      if (!byScreen.has(row.screen_code)) byScreen.set(row.screen_code, []);
      byScreen.get(row.screen_code)!.push(row);
    }
    return byModule;
  }, [grid]);

  // Determine which actions are present in the grid (only show columns that exist)
  const actionsInUse = useMemo(() => {
    const set = new Set(grid.map((r) => r.action));
    return ALL_ACTIONS.filter((a) => set.has(a));
  }, [grid]);

  const toggle = async (cell: PermissionCell) => {
    if (readOnly) return;
    const key = `${cell.screen_code}:${cell.action}`;
    setBusyKey(key);
    setError(null);
    const newGranted = !cell.granted;
    // Optimistic update
    setGrid((prev) => prev.map((r) =>
      r.screen_code === cell.screen_code && r.action === cell.action
        ? { ...r, granted: newGranted } : r
    ));
    try {
      await onToggle(cell.screen_code, cell.action, newGranted);
    } catch (e) {
      // Roll back
      setGrid((prev) => prev.map((r) =>
        r.screen_code === cell.screen_code && r.action === cell.action
          ? { ...r, granted: cell.granted } : r
      ));
      setError((e as Error).message);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="px-3 py-2 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
          {error}
        </div>
      )}
      <div className="text-xs text-gray-500">
        {t('admin.users.permissionsHint')}
      </div>

      {[...grouped.entries()].map(([module, byScreen]) => {
        const screens = [...byScreen.entries()].sort(
          (a, b) => (a[1][0]?.display_order ?? 0) - (b[1][0]?.display_order ?? 0)
        );
        return (
          <div key={module} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700">{module}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-white">
                    <th className="text-start px-4 py-2 font-medium text-gray-700 sticky start-0 bg-white z-10">{t('common.name')}</th>
                    {actionsInUse.map((a) => (
                      <th key={a} className="text-center px-2 py-2 font-medium text-xs text-gray-600 min-w-[80px]">
                        {t(`admin.actions.${a}` as any)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {screens.map(([screenCode, cells]) => {
                    const sample = cells[0];
                    return (
                      <tr key={screenCode} className="border-b border-gray-100 last:border-b-0">
                        <td className="px-4 py-2.5 sticky start-0 bg-white z-10">
                          <div className="font-medium" dir="auto">
                            {locale === 'ar' ? sample.label_ar : sample.label_en}
                          </div>
                          <div className="text-xs text-gray-400 font-mono">{screenCode}</div>
                        </td>
                        {actionsInUse.map((a) => {
                          const cell = cells.find((c) => c.action === a);
                          if (!cell) {
                            return <td key={a} className="text-center px-2 py-2.5 text-gray-300">—</td>;
                          }
                          const key = `${cell.screen_code}:${cell.action}`;
                          const busy = busyKey === key;
                          return (
                            <td key={a} className="text-center px-2 py-2.5">
                              <button
                                type="button"
                                disabled={readOnly || busy}
                                onClick={() => toggle(cell)}
                                className={`
                                  inline-flex items-center justify-center w-6 h-6 rounded
                                  ${cell.granted
                                    ? 'bg-brand-600 text-white hover:bg-brand-700'
                                    : 'bg-white text-gray-400 border border-gray-300 hover:bg-gray-50'}
                                  ${busy ? 'opacity-50 cursor-wait' : ''}
                                  ${readOnly ? 'cursor-default' : 'cursor-pointer'}
                                `}
                              >
                                {cell.granted && <Check className="w-4 h-4" />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
