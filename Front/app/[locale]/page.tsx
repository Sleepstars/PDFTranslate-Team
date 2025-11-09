'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const locale = pathname.split('/')[1];

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push(`/${locale}/login`);
      } else {
        router.push(user.role === 'admin' ? `/${locale}/admin/users` : `/${locale}/dashboard`);
      }
    }
  }, [user, isLoading, router, locale]);

  return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
}
