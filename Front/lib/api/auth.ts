import { clientApi } from '@/lib/http/client';
import type { LoginRequest, LoginResponse, SessionResponse } from '@/lib/types/auth';

export const authApi = {
  login: (data: LoginRequest) =>
    clientApi.post<LoginResponse>('/auth/login', data),

  logout: () =>
    clientApi.post<{ ok: boolean }>('/auth/logout'),

  getSession: () =>
    clientApi.get<SessionResponse>('/auth/me'),
};

