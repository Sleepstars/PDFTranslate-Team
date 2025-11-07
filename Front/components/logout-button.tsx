'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { clientApi } from '@/lib/http/client';

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    setPending(true);
    try {
      await clientApi.post('/auth/logout');
      router.replace('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout failed', error);
    } finally {
      setPending(false);
    }
  }

  return (
    <button className="ghost-button" type="button" onClick={handleLogout} disabled={pending}>
      {pending ? '退出中...' : '退出登录'}
    </button>
  );
}
