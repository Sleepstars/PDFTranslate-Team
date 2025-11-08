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

export interface TaskStats {
  total: number;
  by_status: Record<string, number>;
  by_engine: Record<string, number>;
  by_priority: Record<string, number>;
  recent_activity: Task[];
}
