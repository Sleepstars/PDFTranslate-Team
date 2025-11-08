"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  Boxes,
  Key,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  {
    title: "任务控制台",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "我的任务",
    href: "/tasks",
    icon: FileText,
  },
  {
    title: "用户管理",
    href: "/admin/users",
    icon: Users,
    adminOnly: true,
  },
  {
    title: "服务配置",
    href: "/admin/providers",
    icon: Boxes,
    adminOnly: true,
  },
  {
    title: "访问管理",
    href: "/admin/access",
    icon: Key,
    adminOnly: true,
  },
  {
    title: "系统设置",
    href: "/settings",
    icon: Settings,
    adminOnly: true,
  },
];

interface SidebarNavProps {
  userRole: string;
}

export function SidebarNav({ userRole }: SidebarNavProps) {
  const pathname = usePathname();
  const isAdmin = userRole === "admin";

  const filteredItems = navItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  return (
    <nav className="flex flex-col gap-1">
      {filteredItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-slate-800",
              isActive
                ? "bg-slate-800 text-white font-medium"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}

