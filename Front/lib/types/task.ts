export interface Task {
  id: string;
  ownerId: string;
  ownerEmail: string;
  documentName: string;
  sourceLang: string;
  targetLang: string;
  engine: string;
  priority: 'normal' | 'high';
  notes?: string;
  status: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  outputUrl?: string;
  monoOutputUrl?: string;
  dualOutputUrl?: string;
  glossaryOutputUrl?: string;
  progressMessage?: string;
  error?: string;
  pageCount: number;
  providerConfigId?: string;
}

export interface CreateTaskRequest {
  file: File;
  documentName: string;
  sourceLang: string;
  targetLang: string;
  engine: string;
  priority: 'normal' | 'high';
  notes?: string;
  modelConfig?: string;
  providerConfigId?: string;
}

export interface CreateBatchTasksRequest {
  files: File[];
  documentNames: string[];
  sourceLang: string;
  targetLang: string;
  engine: string;
  priority: 'normal' | 'high';
  notes?: string;
  modelConfig?: string;
  providerConfigId?: string;
}

export interface TaskStats {
  total: number;
  by_status: Record<string, number>;
  by_engine: Record<string, number>;
  by_priority: Record<string, number>;
  recent_activity: Task[];
}

export interface TasksListResponse {
  tasks: Task[];
  total: number;
  limit: number;
  offset: number;
  filters: {
    status?: string | null;
    engine?: string | null;
    priority?: string | null;
    date_from?: string | null;
    date_to?: string | null;
  };
}

export type TaskSocketMessage = {
  type: 'task.update';
  task: Task;
};
