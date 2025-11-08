import type { CreateTaskRequest, CreateBatchTasksRequest, TaskStats, TasksListResponse, Task } from '../types/task';

async function fetchAPI<T>(url: string, options?: RequestInit): Promise<T> {
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
    const queryString = query.toString();
    const url = queryString ? `/api/tasks?${queryString}` : '/api/tasks';
    return fetchAPI<TasksListResponse>(url);
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
    if (data.providerConfigId) formData.append('providerConfigId', data.providerConfigId);

    const res = await fetch('/api/tasks', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to create task');
    return res.json() as Promise<{ task: Task }>;
  },

  createBatch: async (data: CreateBatchTasksRequest) => {
    const formData = new FormData();
    data.files.forEach((file) => formData.append('files', file));
    formData.append('documentNames', JSON.stringify(data.documentNames));
    formData.append('sourceLang', data.sourceLang);
    formData.append('targetLang', data.targetLang);
    formData.append('engine', data.engine);
    formData.append('priority', data.priority);
    if (data.notes) formData.append('notes', data.notes);
    if (data.modelConfig) formData.append('modelConfig', data.modelConfig);
    if (data.providerConfigId) formData.append('providerConfigId', data.providerConfigId);

    const res = await fetch('/api/tasks/batch', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to create batch tasks');
    return res.json() as Promise<{ tasks: Task[]; count: number }>;
  },

  get: (id: string) => fetchAPI<{ task: Task }>(`/api/tasks/${id}`),

  cancel: (id: string) =>
    fetchAPI<{ task: Task | null }>(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    }),

  retry: (id: string) =>
    fetchAPI<{ task: Task }>(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'retry' }),
    }),

  delete: async (id: string) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete task');
  },

  getStats: (): Promise<TaskStats> => fetchAPI('/api/tasks/stats/overview'),
};
