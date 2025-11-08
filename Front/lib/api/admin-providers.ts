import { clientApi } from '@/lib/http/client';
import type { ProviderConfig, CreateProviderConfigRequest, UpdateProviderConfigRequest } from '@/lib/types/provider';

export const adminProvidersApi = {
  listProviders: () =>
    clientApi.get<ProviderConfig[]>('/api/admin/providers'),

  getProvider: (providerId: string) =>
    clientApi.get<ProviderConfig>(`/api/admin/providers/${providerId}`),

  createProvider: (data: CreateProviderConfigRequest) =>
    clientApi.post<ProviderConfig>('/api/admin/providers', data),

  updateProvider: (providerId: string, data: UpdateProviderConfigRequest) =>
    clientApi.patch<ProviderConfig>(`/api/admin/providers/${providerId}`, data),

  deleteProvider: (providerId: string) =>
    clientApi.delete<void>(`/api/admin/providers/${providerId}`),
};

