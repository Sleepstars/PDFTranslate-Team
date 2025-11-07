import { clientApi } from '@/lib/http/client';
import type { CreateTaskPayload, SerializedTask } from './types';

export async function fetchTasks() {
  const data = await clientApi.get<{ tasks: SerializedTask[] }>('/tasks');
  return data.tasks;
}

export async function createTask(payload: CreateTaskPayload) {
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('documentName', payload.documentName);
  formData.append('sourceLang', payload.sourceLang);
  formData.append('targetLang', payload.targetLang);
  formData.append('engine', payload.engine);
  formData.append('priority', payload.priority || 'normal');
  if (payload.notes) formData.append('notes', payload.notes);
  if (payload.modelConfig) formData.append('modelConfig', JSON.stringify(payload.modelConfig));

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/tasks`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to create task');
  }

  const data = await response.json();
  return data.task;
}

export async function mutateTask(taskId: string, action: 'retry' | 'cancel') {
  const data = await clientApi.patch<{ task: SerializedTask }>(`/tasks/${taskId}`, { action });
  return data.task;
}
