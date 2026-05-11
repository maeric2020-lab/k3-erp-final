'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

interface SwitchProps {
  id?: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

export function Switch({ id, checked, onCheckedChange, disabled, ...rest }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-input'
      )}
      {...rest}
    >
      <span
        className={cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform',
          // RTL: when off, knob sits on the right (which visually = start in RTL)
          checked ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}
