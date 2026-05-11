'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { userProfileSchema, type UserProfileInput } from '@k3/validators';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Alert } from '@/components/ui/alert';

export function NewUserForm() {
  const t = useTranslations();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<UserProfileInput>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: {
      email: '',
      full_name_ar: '',
      full_name_en: '',
      phone: '',
      technician_code: '',
      is_super_admin: false,
      is_active: true,
    },
  });

  const onSubmit = async (values: UserProfileInput) => {
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      const body = await res.json();
      router.push(`/admin/users/${body.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="bg-white p-6 rounded-lg border border-gray-200 space-y-4">
      {error && <Alert variant="destructive">{error}</Alert>}

      <div>
        <Label htmlFor="email" required>{t('admin.users.email')}</Label>
        <Input id="email" type="email" {...form.register('email')} dir="ltr" placeholder="user@example.com" />
        {form.formState.errors.email && <p className="text-xs text-red-600 mt-1">{form.formState.errors.email.message as string}</p>}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="full_name_ar" required>{t('common.name_ar')}</Label>
          <Input id="full_name_ar" {...form.register('full_name_ar')} dir="rtl" />
          {form.formState.errors.full_name_ar && <p className="text-xs text-red-600 mt-1">{form.formState.errors.full_name_ar.message as string}</p>}
        </div>
        <div>
          <Label htmlFor="full_name_en">{t('common.name_en')}</Label>
          <Input id="full_name_en" {...form.register('full_name_en')} dir="ltr" />
        </div>
        <div>
          <Label htmlFor="phone">{t('admin.users.phone')}</Label>
          <Input id="phone" {...form.register('phone')} dir="ltr" placeholder="+965 …" />
        </div>
        <div>
          <Label htmlFor="technician_code">{t('admin.users.technicianId')}</Label>
          <Input id="technician_code" {...form.register('technician_code')} dir="ltr" placeholder="TECH-01" />
        </div>
      </div>

      <div className="flex items-center gap-6 pt-2">
        <div className="flex items-center gap-2">
          <Switch checked={form.watch('is_active')} onCheckedChange={(v) => form.setValue('is_active', v)} />
          <Label className="!mb-0">{form.watch('is_active') ? t('common.active') : t('common.inactive')}</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.watch('is_super_admin')} onCheckedChange={(v) => form.setValue('is_super_admin', v)} />
          <Label className="!mb-0">{t('admin.users.isSuperAdmin')}</Label>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t('common.loading') : t('admin.users.invite')}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>{t('common.cancel')}</Button>
      </div>
    </form>
  );
}
