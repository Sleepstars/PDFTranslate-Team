'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else {
        router.push(user.role === 'admin' ? '/admin/users' : '/dashboard');
      }
    }
  }, [user, isLoading, router]);

  return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
}
