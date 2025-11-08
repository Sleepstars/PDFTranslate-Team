import { useAuth } from './use-auth';

export function useRole() {
  const { user } = useAuth();

  return {
    isAdmin: user?.role === 'admin',
    isUser: user?.role === 'user',
    role: user?.role,
  };
}
