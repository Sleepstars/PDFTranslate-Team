import { serverApi } from '@/lib/http/server';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export async function getCurrentUser() {
  try {
    const data = await serverApi.get<{ user: AuthUser | null }>('/auth/me');
    return data.user;
  } catch (error) {
    return null;
  }
}
