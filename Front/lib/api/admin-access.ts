import { clientApi } from '@/lib/http/client';
import type { UserProviderAccess, GrantProviderAccessRequest } from '@/lib/types/access';

export const adminAccessApi = {
  listAllAccess: () =>
    clientApi.get<UserProviderAccess[]>('/api/admin/providers/access/all'),

  grantAccess: (data: GrantProviderAccessRequest) =>
    clientApi.post<UserProviderAccess>('/api/admin/providers/access', data),

  revokeAccess: (accessId: string) =>
    clientApi.delete<void>(`/api/admin/providers/access/${accessId}`),
};

