export const locales = ['ar', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'ar';

export const localeMetadata: Record<Locale, { name: string; dir: 'rtl' | 'ltr' }> = {
  ar: { name: 'العربية', dir: 'rtl' },
  en: { name: 'English', dir: 'ltr' },
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
