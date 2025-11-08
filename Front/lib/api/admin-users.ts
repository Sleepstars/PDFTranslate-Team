import type { CreateUserRequest, UpdateUserRequest } from '../types/user';

async function fetchAPI(url: string, options?: RequestInit) {
  const res = await fetch(url, { ...options, credentials: 'include' });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }
  return res.json();
}

export const adminUsersAPI = {
  list: () => fetchAPI('/api/admin/users'),

  create: (data: CreateUserRequest) =>
    fetchAPI('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  get: (id: string) => fetchAPI(`/api/admin/users/${id}`),

  update: (id: string, data: UpdateUserRequest) =>
    fetchAPI(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchAPI(`/api/admin/users/${id}`, { method: 'DELETE' }),

  updateQuota: (id: string, dailyPageLimit: number) =>
    fetchAPI(`/api/admin/users/${id}/quota`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dailyPageLimit }),
    }),
};
