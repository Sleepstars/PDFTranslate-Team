'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRole } from '@/lib/hooks/use-role';
import { cn } from '@/lib/utils';
import { LayoutDashboard, FileText, Users, Settings, Shield, Boxes } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';

export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin } = useRole();
  const t = useTranslations('nav');
  const locale = useLocale();

  const userLinks = [
    { href: `/${locale}/dashboard`, label: t('dashboard'), icon: LayoutDashboard },
    { href: `/${locale}/tasks`, label: t('tasks'), icon: FileText },
  ];

  const adminLinks = [
    { href: `/${locale}/admin/users`, label: t('users'), icon: Users },
    { href: `/${locale}/admin/providers`, label: t('providers'), icon: Boxes },
    { href: `/${locale}/admin/access`, label: t('access'), icon: Shield },
    { href: `/${locale}/admin/settings`, label: t('settings'), icon: Settings },
  ];

  return (
    <div className="w-56 bg-card border-r border-border min-h-screen flex flex-col">
      <div className="px-4 py-4 border-b border-border">
        <h2 className="text-lg font-semibold">PDF Translate</h2>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {userLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors',
                pathname === link.href
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
        {isAdmin && (
          <>
            <div className="pt-4 pb-2 px-3">
              <p className="text-xs font-medium text-muted-foreground">{t('admin')}</p>
            </div>
            {adminLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors',
                    pathname === link.href
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>
    </div>
  );
}
