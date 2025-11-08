import { Task, CreateTaskRequest, TaskStats } from '../types/task';

async function fetchAPI(url: string, options?: RequestInit) {
  const res = await fetch(url, { ...options, credentials: 'include' });
  if (!res.ok) throw new Error('Request failed');
  return res.json();
}

export const tasksAPI = {
  list: (params?: { status?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    return fetchAPI(`/tasks?${query}`);
  },

  create: async (data: CreateTaskRequest) => {
    const formData = new FormData();
    formData.append('file', data.file);
    formData.append('documentName', data.documentName);
    formData.append('sourceLang', data.sourceLang);
    formData.append('targetLang', data.targetLang);
    formData.append('engine', data.engine);
    formData.append('priority', data.priority);
    if (data.notes) formData.append('notes', data.notes);
    if (data.modelConfig) formData.append('modelConfig', data.modelConfig);
    if (data.providerConfigId) formData.append('providerConfigId', data.providerConfigId);

    const res = await fetch('/tasks', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to create task');
    return res.json();
  },

  get: (id: string) => fetchAPI(`/tasks/${id}`),

  cancel: (id: string) =>
    fetchAPI(`/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    }),

  retry: (id: string) =>
    fetchAPI(`/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'retry' }),
    }),

  getStats: (): Promise<TaskStats> => fetchAPI('/tasks/stats/overview'),
};
