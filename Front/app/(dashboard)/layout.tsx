import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { LogoutButton } from '@/components/logout-button';
import { SidebarNav } from '@/components/dashboard/sidebar-nav';
import { Badge } from '@/components/ui/badge';

export default async function DashboardLayout({
  children
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <p className="text-xs uppercase tracking-wider text-slate-400">BabelDOC</p>
          <h2 className="text-xl font-bold mt-1">PDFTranslate</h2>
        </div>

        <div className="flex-1 p-4">
          <SidebarNav userRole={user.role} />
        </div>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
            {user.role === 'admin' && (
              <Badge variant="secondary" className="text-xs">管理员</Badge>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="border-b bg-white px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">翻译作业</p>
              <h1 className="text-2xl font-bold mt-1">任务概览</h1>
            </div>
            <LogoutButton />
          </div>
        </header>

        <main className="flex-1 p-8 bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  );
}
