'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { bootstrapAdminSchema, type BootstrapAdminInput } from '@k3/validators';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function SetupForm() {
  const t = useTranslations('setup');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<BootstrapAdminInput>({
    resolver: zodResolver(bootstrapAdminSchema),
    defaultValues: {
      full_name_ar: '',
      full_name_en: '',
      email: '',
      password: '',
      password_confirm: '',
    },
  });

  async function onSubmit(values: BootstrapAdminInput) {
    setServerError(null);
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const body = await res.json();
      if (!res.ok) {
        setServerError(body?.error ?? tCommon('errorGeneric'));
        return;
      }
      setSuccess(true);
      // Brief pause so the user sees the success state, then push to login
      setTimeout(() => {
        router.push('/login');
        router.refresh();
      }, 1200);
    } catch (e: any) {
      setServerError(e?.message ?? tCommon('errorGeneric'));
    }
  }

  if (success) {
    return (
      <Alert variant="success">
        <AlertDescription>
          <strong className="block">{t('successTitle')}</strong>
          <span className="text-sm">{t('successHint')}</span>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="full_name_ar">{t('fullNameAr')}</Label>
        <Input id="full_name_ar" {...form.register('full_name_ar')} autoComplete="name" />
        {form.formState.errors.full_name_ar && (
          <p className="text-sm text-destructive">{form.formState.errors.full_name_ar.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="full_name_en">{t('fullNameEn')}</Label>
        <Input id="full_name_en" {...form.register('full_name_en')} dir="ltr" autoComplete="name" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t('email')}</Label>
        <Input id="email" type="email" dir="ltr" {...form.register('email')} autoComplete="email" />
        {form.formState.errors.email && (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="password">{t('password')}</Label>
          <Input id="password" type="password" dir="ltr" {...form.register('password')} autoComplete="new-password" />
          {form.formState.errors.password && (
            <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password_confirm">{t('password')}</Label>
          <Input
            id="password_confirm"
            type="password"
            dir="ltr"
            {...form.register('password_confirm')}
            autoComplete="new-password"
          />
          {form.formState.errors.password_confirm && (
            <p className="text-sm text-destructive">{form.formState.errors.password_confirm.message}</p>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t('passwordHint')}</p>

      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? tCommon('submitting') : t('createAdmin')}
      </Button>
    </form>
  );
}
