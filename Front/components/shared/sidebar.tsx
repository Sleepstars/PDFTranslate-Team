'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useRole } from '@/lib/hooks/use-role';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin } = useRole();
  const { theme, setTheme } = useTheme();

  const userLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/tasks', label: 'Tasks' },
  ];

  const adminLinks = [
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/providers', label: 'Providers' },
    { href: '/admin/access', label: 'Access Control' },
    { href: '/admin/settings', label: 'Settings' },
  ];

  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const getThemeIcon = () => {
    if (theme === 'light') {
      return <Sun className="h-5 w-5" />;
    } else if (theme === 'dark') {
      return <Moon className="h-5 w-5" />;
    } else {
      return <Monitor className="h-5 w-5" />;
    }
  };

  return (
    <div className="w-64 bg-card border-r border-border min-h-screen p-4 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">PDF Translate</h2>
        <button
          onClick={cycleTheme}
          className="p-2 rounded-md hover:bg-accent transition-colors"
          title={`Current theme: ${theme || 'system'}`}
        >
          {getThemeIcon()}
        </button>
      </div>
      <nav className="space-y-2 flex-1">
        {userLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'block px-4 py-2 rounded hover:bg-accent transition-colors',
              pathname === link.href && 'bg-accent'
            )}
          >
            {link.label}
          </Link>
        ))}
        {isAdmin && (
          <>
            <div className="pt-4 pb-2 px-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Admin</p>
            </div>
            {adminLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'block px-4 py-2 rounded hover:bg-accent transition-colors',
                  pathname === link.href && 'bg-accent'
                )}
              >
                {link.label}
              </Link>
            ))}
          </>
        )}
      </nav>
    </div>
  );
}
