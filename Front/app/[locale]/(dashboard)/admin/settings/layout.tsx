'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function SettingsLayout({ children, params }: { children: React.ReactNode; params: { locale: string } }) {
  const pathname = usePathname();
  const t = useTranslations('settings');
  const base = `/${params.locale}/admin/settings`;

  const links = [
    { href: `${base}/system`, label: t('systemConfig') },
    { href: `${base}/email`, label: t('emailConfig') },
    { href: `${base}/s3`, label: t('s3Config') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 border-b border-border">
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-2 text-sm border-b-2 ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
      <div>{children}</div>
    </div>
  );
}

