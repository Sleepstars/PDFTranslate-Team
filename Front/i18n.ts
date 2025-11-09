import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';

export const locales = ['en', 'zh'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'zh';

function isSupportedLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

export default getRequestConfig(async ({ locale }) => {
  if (!locale) notFound();
  if (!isSupportedLocale(locale)) notFound();

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default
  };
});
