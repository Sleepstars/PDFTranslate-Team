import { serverApi } from '@/lib/http/server';
import type { SerializedTask } from './types';

export async function fetchTasksServer() {
  try {
    const data = await serverApi.get<{ tasks: SerializedTask[] }>('/tasks');
    return data.tasks;
  } catch (error) {
    console.error('Failed to load tasks', error);
    return [];
  }
}
