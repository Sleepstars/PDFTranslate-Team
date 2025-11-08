export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high';

export interface Task {
  id: string;
  documentName: string;
  sourceLang: string;
  targetLang: string;
  engine: string;
  status: TaskStatus;
  priority: TaskPriority;
  notes?: string;
  pageCount?: number;
  progress?: number;
  errorMessage?: string;
  inputUrl?: string;
  outputUrl?: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  providerConfigId?: string;
  modelConfig?: string;
}

export interface ModelConfig {
  api_key?: string;
  model?: string;
  threads?: number;
  endpoint?: string;
  deployment?: string;
  secret_id?: string;
  secret_key?: string;
}

export interface CreateTaskRequest {
  file: File;
  documentName: string;
  sourceLang: string;
  targetLang: string;
  engine: string;
  priority?: TaskPriority;
  notes?: string;
  modelConfig?: ModelConfig;
  providerConfigId?: string;
}

export interface TaskActionRequest {
  action: 'cancel' | 'retry';
}

export interface TaskStats {
  total: number;
  by_status: Record<TaskStatus, number>;
  by_engine: Record<string, number>;
  by_priority: Record<TaskPriority, number>;
  recent_activity: Task[];
}

export interface TaskListResponse {
  tasks: Task[];
  total: number;
  limit: number;
  offset: number;
  filters: {
    status?: string;
    engine?: string;
    priority?: string;
    date_from?: string;
    date_to?: string;
  };
}

