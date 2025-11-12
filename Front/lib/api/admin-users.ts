import type { CreateUserRequest, UpdateUserRequest, User } from '../types/user';

async function fetchAPI<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, credentials: 'include' });
  const rawBody = res.status === 204 ? '' : await res.text();
  const trimmed = rawBody.trim();
  let data: unknown = null;

  if (trimmed) {
    try {
      data = JSON.parse(trimmed);
    } catch {
      data = trimmed;
    }
  }

  if (!res.ok) {
    const detail =
      (typeof data === 'object' && data !== null && 'detail' in data && typeof (data as Record<string, unknown>).detail === 'string'
        ? (data as Record<string, string>).detail
        : typeof data === 'string'
          ? data
          : null) || 'Request failed';
    throw new Error(detail);
  }

  return data as T;
}

export const adminUsersAPI = {
  list: (): Promise<User[]> => fetchAPI<User[]>('/api/admin/users'),

  create: (data: CreateUserRequest) =>
    fetchAPI<User>('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  get: (id: number): Promise<User> => fetchAPI<User>(`/api/admin/users/${id}`),

  update: (id: number, data: UpdateUserRequest) =>
    fetchAPI<User>(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    fetchAPI<null>(`/api/admin/users/${id}`, { method: 'DELETE' }),

  updateQuota: (id: number, dailyPageLimit: number) =>
    fetchAPI<User>(`/api/admin/users/${id}/quota`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dailyPageLimit }),
    }),
};
