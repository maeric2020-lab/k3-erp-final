import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, isLocale, type Locale } from './config';

export default getRequestConfig(async () => {
  // Read locale from cookie set by the language toggle
  const cookieStore = cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale: Locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
  };
});
