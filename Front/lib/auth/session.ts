import { serverApi } from '@/lib/http/server';
import type { AuthUser } from '@/lib/types/auth';

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const data = await serverApi.get<{ user: AuthUser | null }>('/auth/me');
    return data.user;
  } catch (error) {
    return null;
  }
}

export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === 'admin';
}

export function canAccessAdminRoutes(user: AuthUser | null): boolean {
  return isAdmin(user);
}
