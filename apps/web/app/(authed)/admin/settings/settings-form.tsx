'use client';
import { useState } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Upload } from 'lucide-react';
import { companySettingsSchema, type CompanySettingsInput } from '@k3/validators';
import type { CompanySettings } from '@k3/repositories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { CompanySettingsRepository } from '@k3/repositories';
import { useUnsavedChangesGuard } from '@/lib/hooks/use-unsaved-changes-guard';

interface Props {
  initial: CompanySettings | null;
  initialLogoUrl: string | null;
}

export function CompanySettingsForm({ initial, initialLogoUrl }: Props) {
  const t = useTranslations('companySettings');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [serverError, setServerError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [logoUploading, setLogoUploading] = useState(false);

  const form = useForm<CompanySettingsInput>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      legal_name_ar: initial?.legal_name_ar ?? '',
      legal_name_en: initial?.legal_name_en ?? '',
      short_name: initial?.short_name ?? '',
      address_ar: initial?.address_ar ?? '',
      address_en: initial?.address_en ?? '',
      phone_primary: initial?.phone_primary ?? '',
      phone_secondary: initial?.phone_secondary ?? '',
      email: initial?.email ?? '',
      website: initial?.website ?? '',
      civil_id_no: initial?.civil_id_no ?? '',
      commercial_reg_no: initial?.commercial_reg_no ?? '',
      tax_no: initial?.tax_no ?? '',
      default_currency: 'KWD',
      default_language: (initial?.default_language ?? 'ar') as 'ar' | 'en',
      allow_other_problem: initial?.allow_other_problem ?? false,
      allow_off_catalog_machine: initial?.allow_off_catalog_machine ?? true,
    },
  });

  useUnsavedChangesGuard(form.formState.isDirty, form.formState.isSubmitting);

  async function uploadLogo(file: File) {
    setServerError(null);
    setLogoUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
      const path = `company/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('logos').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });
      if (upErr) throw upErr;

      // Persist path on company_settings
      const repo = new CompanySettingsRepository(supabase);
      await repo.update({ logo_path: path });

      const { data } = supabase.storage.from('logos').getPublicUrl(path);
      setLogoUrl(`${data.publicUrl}?v=${Date.now()}`);
    } catch (e: any) {
      setServerError(e?.message ?? tCommon('errorGeneric'));
    } finally {
      setLogoUploading(false);
    }
  }

  async function onSubmit(values: CompanySettingsInput) {
    setServerError(null);
    setSavedOk(false);
    try {
      const supabase = createSupabaseBrowserClient();
      const repo = new CompanySettingsRepository(supabase);

      // Normalise empty strings to null for nullable text columns
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(values)) {
        patch[k] = typeof v === 'string' && v.trim() === '' ? null : v;
      }
      await repo.update(patch);

      setSavedOk(true);
      form.reset(values);
      router.refresh();
    } catch (e: any) {
      setServerError(e?.message ?? tCommon('errorGeneric'));
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('logo')}</CardTitle>
          <CardDescription>{t('logoHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-md border bg-secondary/40">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">no logo</span>
              )}
            </div>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadLogo(f);
                  e.target.value = '';
                }}
              />
              <span className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-ring">
                <Upload className="h-4 w-4" />
                {logoUploading ? tCommon('submitting') : t('uploadLogo')}
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="legal_name_ar">{t('legalNameAr')}</Label>
              <Input id="legal_name_ar" {...form.register('legal_name_ar')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal_name_en">{t('legalNameEn')}</Label>
              <Input id="legal_name_en" dir="ltr" {...form.register('legal_name_en')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="short_name">{t('shortName')}</Label>
            <Input id="short_name" {...form.register('short_name')} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone_primary">{t('phonePrimary')}</Label>
              <Input id="phone_primary" dir="ltr" {...form.register('phone_primary')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_secondary">{t('phoneSecondary')}</Label>
              <Input id="phone_secondary" dir="ltr" {...form.register('phone_secondary')} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input id="email" type="email" dir="ltr" {...form.register('email')} />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">{t('website')}</Label>
              <Input id="website" type="url" dir="ltr" {...form.register('website')} />
              {form.formState.errors.website && (
                <p className="text-sm text-destructive">{form.formState.errors.website.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address_ar">{t('addressAr')}</Label>
            <Input id="address_ar" {...form.register('address_ar')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address_en">{t('addressEn')}</Label>
            <Input id="address_en" dir="ltr" {...form.register('address_en')} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="civil_id_no">{t('civilIdNo')}</Label>
              <Input id="civil_id_no" dir="ltr" {...form.register('civil_id_no')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commercial_reg_no">{t('commercialRegNo')}</Label>
              <Input id="commercial_reg_no" dir="ltr" {...form.register('commercial_reg_no')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax_no">{t('taxNo')}</Label>
              <Input id="tax_no" dir="ltr" {...form.register('tax_no')} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('currency')}</Label>
              <Input value="KWD" readOnly dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default_language">{t('defaultLanguage')}</Label>
              <select
                id="default_language"
                {...form.register('default_language')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-ring"
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System toggles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-md border p-4">
            <div className="flex-1">
              <Label htmlFor="allow_other_problem" className="text-base">
                {t('allowOtherProblem')}
              </Label>
              <p className="mt-1 text-sm text-muted-foreground">{t('allowOtherProblemHint')}</p>
            </div>
            <Switch
              id="allow_other_problem"
              checked={form.watch('allow_other_problem')}
              onCheckedChange={(v) => form.setValue('allow_other_problem', v, { shouldDirty: true })}
            />
          </div>
        </CardContent>
      </Card>

      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      {savedOk && (
        <Alert variant="success">
          <AlertDescription>{t('saveSuccess')}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-end gap-2 pb-6">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (form.formState.isDirty && !confirm(tCommon('unsavedChanges'))) return;
            form.reset();
          }}
        >
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
          {form.formState.isSubmitting ? tCommon('submitting') : tCommon('save')}
        </Button>
      </div>
    </form>
  );
}
