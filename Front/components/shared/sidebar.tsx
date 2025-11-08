'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRole } from '@/lib/hooks/use-role';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin } = useRole();

  const userLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/tasks', label: 'Tasks' },
  ];

  const adminLinks = [
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/providers', label: 'Providers' },
    { href: '/admin/access', label: 'Access Control' },
  ];

  const links = isAdmin ? adminLinks : userLinks;

  return (
    <div className="w-64 bg-gray-900 text-white min-h-screen p-4">
      <h2 className="text-xl font-bold mb-6">PDF Translate</h2>
      <nav className="space-y-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'block px-4 py-2 rounded hover:bg-gray-800',
              pathname === link.href && 'bg-gray-800'
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
