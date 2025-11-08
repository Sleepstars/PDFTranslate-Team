"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Settings, 
  Shield,
  Key
} from 'lucide-react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  {
    title: '仪表盘',
    href: '/dashboard',
    icon: LayoutDashboard,
    adminOnly: false,
  },
  {
    title: '我的任务',
    href: '/tasks',
    icon: FileText,
    adminOnly: false,
  },
  {
    title: '用户管理',
    href: '/admin/users',
    icon: Users,
    adminOnly: true,
  },
  {
    title: '服务配置',
    href: '/admin/providers',
    icon: Settings,
    adminOnly: true,
  },
  {
    title: '访问管理',
    href: '/admin/access',
    icon: Key,
    adminOnly: true,
  },
];

interface SidebarNavProps {
  userRole: 'admin' | 'user';
}

export function SidebarNav({ userRole }: SidebarNavProps) {
  const pathname = usePathname();
  const isAdmin = userRole === 'admin';

  const filteredItems = navItems.filter(item => 
    !item.adminOnly || isAdmin
  );

  return (
    <nav className="space-y-1">
      {filteredItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-slate-800 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            )}
          >
            <Icon className="h-5 w-5" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}

