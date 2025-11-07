export type TranslationStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'canceled';

export type TranslationPriority = 'normal' | 'high';

export type ModelConfig = {
  model?: string;
  threads?: number;
  endpoint?: string;
};

export type SerializedTask = {
  id: string;
  ownerId: string;
  ownerEmail: string;
  documentName: string;
  sourceLang: string;
  targetLang: string;
  engine: string;
  priority: TranslationPriority;
  notes?: string | null;
  status: TranslationStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  outputUrl?: string | null;
  error?: string | null;
};

export type CreateTaskPayload = {
  file: File;
  documentName: string;
  sourceLang: string;
  targetLang: string;
  engine: string;
  priority?: TranslationPriority;
  notes?: string;
  modelConfig?: ModelConfig;
};
