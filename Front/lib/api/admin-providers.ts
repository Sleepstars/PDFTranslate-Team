import { ProviderConfig, CreateProviderRequest, UpdateProviderRequest } from '../types/provider';
import { UserProviderAccess, GrantAccessRequest } from '../types/access';

async function fetchAPI(url: string, options?: RequestInit) {
  const res = await fetch(url, { ...options, credentials: 'include' });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }
  return res.json();
}

export const adminProvidersAPI = {
  list: () => fetchAPI('/api/admin/providers'),

  create: (data: CreateProviderRequest) =>
    fetchAPI('/api/admin/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  get: (id: string) => fetchAPI(`/api/admin/providers/${id}`),

  update: (id: string, data: UpdateProviderRequest) =>
    fetchAPI(`/api/admin/providers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchAPI(`/api/admin/providers/${id}`, { method: 'DELETE' }),

  listAccess: () => fetchAPI('/api/admin/providers/access/all'),

  grantAccess: (data: GrantAccessRequest) =>
    fetchAPI('/api/admin/providers/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  revokeAccess: (id: string) =>
    fetchAPI(`/api/admin/providers/access/${id}`, { method: 'DELETE' }),
};
