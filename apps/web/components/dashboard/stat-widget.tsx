'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

interface Props {
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  href?: string;
  children?: React.ReactNode;
  /** Tone used for the icon background — green/amber/red/brand */
  tone?: 'brand' | 'green' | 'amber' | 'red';
}

const TONE_CLASSES: Record<NonNullable<Props['tone']>, { bg: string; text: string }> = {
  brand: { bg: 'bg-brand-50', text: 'text-brand-600' },
  green: { bg: 'bg-green-50', text: 'text-green-600' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
  red:   { bg: 'bg-red-50',   text: 'text-red-600' },
};

export function StatWidget({ title, value, subtitle, icon: Icon, iconClassName, href, children, tone = 'brand' }: Props) {
  const tones = TONE_CLASSES[tone];
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-gray-600">{title}</h3>
          <div className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">{value}</div>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2 rounded-lg flex-shrink-0 ${tones.bg}`}>
          <Icon className={`w-5 h-5 ${iconClassName ?? tones.text}`} />
        </div>
      </div>
      {children && <div className="mt-3">{children}</div>}
      {href && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-brand-600 font-medium flex items-center gap-1 hover:gap-2 transition-all">
          View details <ArrowUpRight className="w-3 h-3 rtl:scale-x-[-1]" />
        </div>
      )}
    </>
  );

  const className = "block bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow";
  return href ? <Link href={href} className={className}>{inner}</Link> : <div className={className}>{inner}</div>;
}
