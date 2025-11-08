import { clientApi } from '@/lib/http/client';
import type { User, QuotaStatus } from '@/lib/types/user';
import type { ProviderConfig } from '@/lib/types/provider';

export const usersApi = {
  getCurrentUser: () =>
    clientApi.get<User>('/api/users/me'),

  getQuota: () =>
    clientApi.get<QuotaStatus>('/api/users/me/quota'),

  getAvailableProviders: () =>
    clientApi.get<ProviderConfig[]>('/api/users/me/providers'),
};

