'use client';

import { useAuth } from '@/lib/hooks/use-auth';
import { Button } from '@/components/ui/button';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="bg-card border-b border-border px-6 py-4 flex justify-between items-center">
      <div>
        <h1 className="text-lg font-semibold">Welcome, {user?.name}</h1>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>
      <Button variant="outline" onClick={() => logout()}>
        Logout
      </Button>
    </header>
  );
}
