'use client';

import { useAuth } from '@/lib/hooks/use-auth';
import { useTheme } from 'next-themes';
import { Moon, Sun, User, Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';

export function Header() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('header');

  const switchLocale = () => {
    const newLocale = locale === 'zh' ? 'en' : 'zh';
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <header className="bg-card border-b border-border px-6 py-3 flex items-center justify-end gap-2">
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="p-2 hover:bg-muted rounded-md transition-colors"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
      <button
        onClick={switchLocale}
        className="flex items-center gap-1 px-2 py-2 hover:bg-muted rounded-md transition-colors text-sm"
      >
        <Languages className="h-4 w-4" />
        {locale === 'zh' ? 'EN' : '中'}
      </button>
      <div className="relative group">
        <button className="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-md transition-colors">
          <User className="h-4 w-4" />
          <span className="text-sm">{user?.name}</span>
        </button>
        <div className="absolute right-0 mt-1 w-48 bg-popover border border-border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <button
            onClick={() => logout()}
            className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
          >
            {t('logout')}
          </button>
        </div>
      </div>
    </header>
  );
}
