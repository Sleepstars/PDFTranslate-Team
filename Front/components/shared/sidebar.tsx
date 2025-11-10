'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRole } from '@/lib/hooks/use-role';
import { cn } from '@/lib/utils';
import { LayoutDashboard, FileText, Users, Settings, Boxes, FileType, X } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
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
    { href: `/${locale}/admin/groups`, label: t('groups'), icon: Users },
    { href: `/${locale}/admin/providers`, label: t('providers'), icon: Boxes },
    { href: `/${locale}/admin/settings`, label: t('settings'), icon: Settings },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden animate-in fade-in duration-200"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed md:static inset-y-0 left-0 z-50 w-64 md:w-56 bg-card border-r border-border flex flex-col transition-transform duration-300 md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="px-4 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md">
              <FileType className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent">
                PDF Translate
              </h2>
              <p className="text-xs text-muted-foreground">Team Edition</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-2 hover:bg-muted rounded-md transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {userLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-200',
                pathname === link.href
                  ? 'bg-gradient-to-r from-orange-500/10 to-orange-600/10 text-foreground font-medium shadow-sm border border-orange-500/20'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground hover:translate-x-0.5'
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
                    'flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-200',
                    pathname === link.href
                      ? 'bg-gradient-to-r from-orange-500/10 to-orange-600/10 text-foreground font-medium shadow-sm border border-orange-500/20'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground hover:translate-x-0.5'
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
    </>
  );
}
