export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  groupId?: number;
  isActive: boolean;
  dailyPageLimit: number;
  dailyPageUsed: number;
  lastQuotaReset: string;
  createdAt: string;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
  role: 'admin' | 'user';
  dailyPageLimit: number;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  password?: string;
  role?: 'admin' | 'user';
  groupId?: number;
  isActive?: boolean;
  dailyPageLimit?: number;
}

export interface QuotaStatus {
  dailyPageLimit: number;
  dailyPageUsed: number;
  remaining: number;
  lastQuotaReset: string;
}
