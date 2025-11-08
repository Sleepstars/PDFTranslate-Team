import type { Task, TaskListResponse, TaskStats, TaskActionRequest, CreateTaskRequest } from '@/lib/types/task';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

export const tasksApi = {
  listTasks: async (params?: {
    status?: string;
    engine?: string;
    priority?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  }): Promise<TaskListResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.engine) searchParams.set('engine', params.engine);
    if (params?.priority) searchParams.set('priority', params.priority);
    if (params?.date_from) searchParams.set('date_from', params.date_from);
    if (params?.date_to) searchParams.set('date_to', params.date_to);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());

    const url = `${API_BASE_URL}/tasks?${searchParams.toString()}`;
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch tasks');
    return response.json();
  },

  getTask: async (taskId: string): Promise<{ task: Task }> => {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to fetch task');
    return response.json();
  },

  createTask: async (data: CreateTaskRequest): Promise<{ task: Task }> => {
    const formData = new FormData();
    formData.append('file', data.file);
    formData.append('documentName', data.documentName);
    formData.append('sourceLang', data.sourceLang);
    formData.append('targetLang', data.targetLang);
    formData.append('engine', data.engine);
    if (data.priority) formData.append('priority', data.priority);
    if (data.notes) formData.append('notes', data.notes);
    if (data.modelConfig) formData.append('modelConfig', JSON.stringify(data.modelConfig));
    if (data.providerConfigId) formData.append('providerConfigId', data.providerConfigId);

    const response = await fetch(`${API_BASE_URL}/tasks`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create task' }));
      throw new Error(error.detail || 'Failed to create task');
    }

    return response.json();
  },

  updateTask: async (taskId: string, action: TaskActionRequest): Promise<{ task: Task }> => {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action),
    });
    if (!response.ok) throw new Error('Failed to update task');
    return response.json();
  },

  getStats: async (): Promise<TaskStats> => {
    const response = await fetch(`${API_BASE_URL}/tasks/stats/overview`, {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
  },
};

