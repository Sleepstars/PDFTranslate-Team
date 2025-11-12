export interface S3Config {
  endpoint: string;
  access_key: string;
  bucket: string;
  region: string;
  ttl_days: number;
}

export interface S3ConfigRequest {
  endpoint: string;
  access_key: string;
  secret_key: string;
  bucket: string;
  region: string;
  ttl_days: number;
}

export interface S3TestResponse {
  success: boolean;
  message: string;
}

export interface SystemSettings {
  allowRegistration: boolean;
  altchaEnabled: boolean;
  altchaSecretKey?: string | null;
  allowedEmailSuffixes: string[];
}

export interface UpdateSystemSettingsRequest {
  allowRegistration?: boolean;
  altchaEnabled?: boolean;
  altchaSecretKey?: string;
  allowedEmailSuffixes?: string[];
}

export interface EmailSettings {
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUsername?: string | null;
  smtpUseTLS: boolean;
  smtpFromEmail?: string | null;
  allowedEmailSuffixes: string[];
}

export interface UpdateEmailSettingsRequest {
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string; // not returned by GET; only set when updating
  smtpUseTLS?: boolean;
  smtpFromEmail?: string;
  allowedEmailSuffixes?: string[];
}

export interface EmailTestResponse {
  success: boolean;
  message: string;
}

export interface PerformanceSettings {
  maxConcurrentTasks: number;
  translationThreads: number;
  queueMonitorInterval: number;
}

export interface UpdatePerformanceSettingsRequest {
  maxConcurrentTasks?: number;
  translationThreads?: number;
  queueMonitorInterval?: number;
}

export interface PerformanceMetrics {
  activeTasks: number;
  queuedTasks: number;
  highPriorityQueue: number;
  normalPriorityQueue: number;
  lowPriorityQueue: number;
  currentConfig: PerformanceSettings;
}

async function fetchAPI(url: string, options?: RequestInit) {
  const res = await fetch(url, { ...options, credentials: 'include' });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || error.message || 'Request failed');
  }
  return res.json();
}

export const adminSettingsAPI = {
  getS3Config: (): Promise<S3Config> => 
    fetchAPI('/api/admin/settings/s3'),

  updateS3Config: (data: S3ConfigRequest): Promise<{ message: string }> =>
    fetchAPI('/api/admin/settings/s3', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  testS3Connection: (data: S3ConfigRequest): Promise<S3TestResponse> =>
    fetchAPI('/api/admin/settings/s3/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // System
  getSystem: (): Promise<SystemSettings> =>
    fetchAPI('/api/admin/settings/system'),

  updateSystem: (data: UpdateSystemSettingsRequest): Promise<{ message: string }> =>
    fetchAPI('/api/admin/settings/system', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // Email
  getEmail: (): Promise<EmailSettings> =>
    fetchAPI('/api/admin/settings/email'),

  updateEmail: (data: UpdateEmailSettingsRequest): Promise<{ message: string }> =>
    fetchAPI('/api/admin/settings/email', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  sendTestEmail: (): Promise<EmailTestResponse> =>
    fetchAPI('/api/admin/settings/email/test', {
      method: 'POST',
    }),

  // Performance
  getPerformance: (): Promise<PerformanceSettings> =>
    fetchAPI('/api/admin/settings/performance'),

  updatePerformance: (data: UpdatePerformanceSettingsRequest): Promise<{ message: string }> =>
    fetchAPI('/api/admin/settings/performance', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  getPerformanceMetrics: (): Promise<PerformanceMetrics> =>
    fetchAPI('/api/admin/settings/performance/metrics'),
};
