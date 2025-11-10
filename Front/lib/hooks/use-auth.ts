import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCurrentUser, login, logout } from '../api/auth';
import { useRouter, usePathname } from 'next/navigation';

export function useAuth() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split('/')[1] || 'zh';

  const { data: user, isLoading, refetch } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getCurrentUser,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login(email, password),
    onSuccess: (user) => {
      queryClient.setQueryData(['auth', 'me'], user);
      router.push(user.role === 'admin' ? `/${locale}/admin/users` : `/${locale}/dashboard`);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null);
      router.push(`/${locale}/login`);
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    refetch,
  };
}
