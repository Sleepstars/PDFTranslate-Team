export interface Group {
  id: string;
  name: string;
  createdAt: string;
  userCount: number;
  providerCount: number;
}

export interface GroupProviderAccess {
  id: string;
  groupId: string;
  providerConfigId: string;
  sortOrder: number;
  createdAt: string;
}

async function fetchAPI(url: string, options?: RequestInit) {
  const res = await fetch(url, { ...options, credentials: 'include' });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }
  // Handle 204 No Content responses
  if (res.status === 204) {
    return null;
  }
  return res.json();
}

export const adminGroupsAPI = {
  list: (): Promise<Group[]> => fetchAPI('/api/admin/groups'),
  create: (name: string): Promise<Group> =>
    fetchAPI('/api/admin/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }),
  update: (groupId: string, name: string): Promise<Group> =>
    fetchAPI(`/api/admin/groups/${groupId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }),
  delete: (groupId: string): Promise<void> =>
    fetchAPI(`/api/admin/groups/${groupId}`, { method: 'DELETE' }),
  merge: (targetGroupId: string, sourceGroupIds: string[]): Promise<Group> =>
    fetchAPI(`/api/admin/groups/${targetGroupId}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceGroupIds }),
    }),
  listAccess: (groupId: string): Promise<GroupProviderAccess[]> =>
    fetchAPI(`/api/admin/groups/${groupId}/access`),
  grantAccess: (groupId: string, providerConfigId: string, sortOrder?: number): Promise<GroupProviderAccess> =>
    fetchAPI(`/api/admin/groups/${groupId}/access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerConfigId, sortOrder }),
    }),
  revokeAccess: (groupId: string, providerConfigId: string): Promise<void> =>
    fetchAPI(`/api/admin/groups/${groupId}/access/${providerConfigId}`, { method: 'DELETE' }),
  reorder: (groupId: string, providerIds: string[]): Promise<{ ok: boolean }> =>
    fetchAPI(`/api/admin/groups/${groupId}/access/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerIds }),
    }),
};
