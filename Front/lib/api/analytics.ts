const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface AnalyticsOverview {
  todayTranslations: number;
  todayPages: number;
  totalUsers: number;
  activeUsers: number;
}

export interface DailyStatsItem {
  date: string;
  translations: number;
  pages: number;
}

export interface DailyStatsResponse {
  stats: DailyStatsItem[];
}

export interface TopUserItem {
  userId: string;
  userName: string;
  userEmail: string;
  totalPages: number;
  totalTasks: number;
}

export interface TopUsersResponse {
  users: TopUserItem[];
}

export interface AdminTasksResponse {
  tasks: any[];
  total: number;
  limit: number;
  offset: number;
  filters: {
    ownerId?: string;
    status?: string;
    engine?: string;
    priority?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const res = await fetch(`${API_BASE}/api/admin/analytics/overview`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch analytics overview');
  return res.json();
}

export async function getDailyStats(days: number = 30): Promise<DailyStatsResponse> {
  const res = await fetch(`${API_BASE}/api/admin/analytics/daily-stats?days=${days}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch daily stats');
  return res.json();
}

export async function getTopUsers(limit: number = 10, days?: number): Promise<TopUsersResponse> {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (days) params.append('days', days.toString());

  const res = await fetch(`${API_BASE}/api/admin/analytics/top-users?${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch top users');
  return res.json();
}

export async function getAdminTasks(params: {
  ownerId?: string;
  ownerEmail?: string;
  status?: string;
  engine?: string;
  priority?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminTasksResponse> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, value.toString());
    }
  });

  const res = await fetch(`${API_BASE}/api/admin/tasks?${searchParams}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch admin tasks');
  return res.json();
}

export async function cancelAdminTask(taskId: string): Promise<{ task: any }> {
  const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'cancel' }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to cancel task');
  return res.json();
}

export async function retryAdminTask(taskId: string): Promise<{ task: any }> {
  const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'retry' }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to retry task');
  return res.json();
}

export async function deleteAdminTask(taskId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to delete task');
}
