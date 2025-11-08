import { User, QuotaStatus } from '../types/user';
import { ProviderConfig } from '../types/provider';

async function fetchAPI(url: string, options?: RequestInit) {
  const res = await fetch(url, { ...options, credentials: 'include' });
  if (!res.ok) throw new Error('Request failed');
  return res.json();
}

export const usersAPI = {
  getMe: (): Promise<User> => fetchAPI('/api/users/me'),
  getQuota: (): Promise<QuotaStatus> => fetchAPI('/api/users/me/quota'),
  getProviders: (): Promise<ProviderConfig[]> => fetchAPI('/api/users/me/providers'),
};
