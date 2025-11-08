import { clientApi } from '@/lib/http/client';
import type { User, CreateUserRequest, UpdateUserRequest, UpdateQuotaRequest } from '@/lib/types/user';

export const adminUsersApi = {
  listUsers: () =>
    clientApi.get<User[]>('/api/admin/users'),

  getUser: (userId: string) =>
    clientApi.get<User>(`/api/admin/users/${userId}`),

  createUser: (data: CreateUserRequest) =>
    clientApi.post<User>('/api/admin/users', data),

  updateUser: (userId: string, data: UpdateUserRequest) =>
    clientApi.patch<User>(`/api/admin/users/${userId}`, data),

  deleteUser: (userId: string) =>
    clientApi.delete<void>(`/api/admin/users/${userId}`),

  updateQuota: (userId: string, data: UpdateQuotaRequest) =>
    clientApi.patch<User>(`/api/admin/users/${userId}/quota`, data),
};

