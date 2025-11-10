export type TaskType = 'translation' | 'parsing' | 'parse_and_translate';

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
  inputUrl?: string;
  outputUrl?: string;
  monoOutputUrl?: string;
  dualOutputUrl?: string;
  glossaryOutputUrl?: string;
  zipOutputUrl?: string;
  progressMessage?: string;
  error?: string;
  pageCount: number;
  providerConfigId?: string;
  taskType: TaskType;
  markdownOutputUrl?: string;
  translatedMarkdownUrl?: string;
  mineruTaskId?: string;
}

export interface CreateTaskRequest {
  file: File;
  documentName: string;
  taskType?: TaskType;
  sourceLang?: string;  // Optional for parsing-only tasks
  targetLang?: string;  // Optional for parsing-only tasks
  engine?: string;      // Optional for parsing-only tasks
  priority: 'normal' | 'high';
  notes?: string;
  modelConfig?: string;
  providerConfigId?: string;
}

export interface CreateBatchTasksRequest {
  files: File[];
  documentNames: string[];
  taskType?: TaskType;
  sourceLang?: string;  // Optional for parsing-only tasks
  targetLang?: string;  // Optional for parsing-only tasks
  engine?: string;      // Optional for parsing-only tasks
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
