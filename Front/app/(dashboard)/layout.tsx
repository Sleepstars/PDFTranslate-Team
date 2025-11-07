import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { LogoutButton } from '@/components/logout-button';

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
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <p className="eyebrow">BabelDOC</p>
          <h2>PDFTranslate</h2>
        </div>
        <nav>
          <Link href="/dashboard" className="nav-item">任务控制台</Link>
          {user.email === 'admin@example.com' && (
            <Link href="/settings" className="nav-item">设置</Link>
          )}
        </nav>
        <div className="sidebar-footer">
          <p>{user.name}</p>
          <span>{user.email}</span>
        </div>
      </aside>
      <div className="main-column">
        <header className="top-bar">
          <div>
            <p className="eyebrow">翻译作业</p>
            <h1>任务概览</h1>
          </div>
          <div className="user-controls">
            <div>
              <p>{user.name}</p>
              <span>{user.email}</span>
            </div>
            <LogoutButton />
          </div>
        </header>
        <div className="content-area">{children}</div>
      </div>
    </div>
  );
}
