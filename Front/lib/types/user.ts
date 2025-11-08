export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  dailyPageLimit: number;
  dailyPageUsed: number;
  lastQuotaReset: string;
  createdAt: string;
}

export interface QuotaStatus {
  dailyPageLimit: number;
  dailyPageUsed: number;
  remaining: number;
  lastQuotaReset: string;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  dailyPageLimit: number;
}

export interface UpdateUserRequest {
  name?: string;
  role?: UserRole;
  isActive?: boolean;
  dailyPageLimit?: number;
}

export interface UpdateQuotaRequest {
  dailyPageLimit: number;
}

