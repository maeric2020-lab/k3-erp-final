'use client';
import { useEffect } from 'react';

/**
 * Warns the user when they try to leave a page (close tab / navigate away)
 * with unsaved form changes.
 *
 * Usage:
 *   const form = useForm({...});
 *   useUnsavedChangesGuard(form.formState.isDirty, form.formState.isSubmitting);
 *
 * Note: Next.js App Router does not yet provide a clean hook for client-side
 * intra-app navigation interception. This guard handles tab close + reload,
 * which covers the dangerous cases. The `confirm()` cancel pattern in form
 * cancel buttons handles in-app navigation explicitly.
 */
export function useUnsavedChangesGuard(isDirty: boolean, isSubmitting = false) {
  useEffect(() => {
    if (!isDirty || isSubmitting) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore the returnValue text but still show their default prompt.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty, isSubmitting]);
}
