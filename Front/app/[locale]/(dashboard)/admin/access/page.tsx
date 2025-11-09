'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminProvidersAPI } from '@/lib/api/admin-providers';
import { adminUsersAPI } from '@/lib/api/admin-users';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserProviderAccess } from '@/lib/types/access';
import { User } from '@/lib/types/user';
import { ProviderConfig } from '@/lib/types/provider';
import { useTranslations } from 'next-intl';

export default function AdminAccessPage() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const t = useTranslations('access');
  const _tCommon = useTranslations('common');

  const { data: accesses = [], isLoading } = useQuery({
    queryKey: ['admin', 'access'],
    queryFn: adminProvidersAPI.listAccess,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: adminUsersAPI.list,
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['admin', 'providers'],
    queryFn: adminProvidersAPI.list,
  });

  const revokeMutation = useMutation({
    mutationFn: adminProvidersAPI.revokeAccess,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'access'] });
    },
  });

  if (isLoading) return <div className="flex items-center justify-center h-64">{_tCommon('loading')}</div>;

  const getUserName = (userId: string) => (users as User[]).find((u) => u.id === userId)?.name || userId;
  const getProviderName = (providerId: string) => (providers as ProviderConfig[]).find((p) => p.id === providerId)?.name || providerId;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold mb-1">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => setShowDialog(true)} size="sm" className="h-9">
          + {t('grant')}
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-visible">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border">
            <tr className="text-xs text-muted-foreground">
              <th className="px-4 py-2.5 text-left font-medium">{t('user')}</th>
              <th className="px-4 py-2.5 text-left font-medium">{t('provider')}</th>
              <th className="px-4 py-2.5 text-left font-medium">{t('default')}</th>
              <th className="px-4 py-2.5 text-left font-medium">{t('grantedAt')}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {accesses.map((access: UserProviderAccess) => (
              <tr key={access.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 text-sm">{getUserName(access.userId)}</td>
                <td className="px-4 py-2.5 text-sm">{getProviderName(access.providerConfigId)}</td>
                <td className="px-4 py-2.5">
                  {access.isDefault && <Badge variant="warning" className="text-xs">{t('default')}</Badge>}
                </td>
                <td className="px-4 py-2.5 text-sm">{new Date(access.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => revokeMutation.mutate(access.id)}
                    className="p-1 hover:bg-muted rounded transition-colors text-destructive"
                    title={t('revoke')}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showDialog && <GrantAccessDialog users={users} providers={providers} onClose={() => setShowDialog(false)} />}
    </div>
  );
}

function GrantAccessDialog({ users, providers, onClose }: { users: User[]; providers: ProviderConfig[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    userId: '',
    providerConfigId: '',
    isDefault: false,
  });
  const t = useTranslations('access.grantDialog');
  const _tCommon = useTranslations('common');

  const grantMutation = useMutation({
    mutationFn: adminProvidersAPI.grantAccess,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'access'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    grantMutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">{t('title')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('user')}</label>
            <select
              className="w-full border-input bg-background border rounded px-3 py-2"
              value={formData.userId}
              onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
              required
            >
              <option value="">{t('selectUser')}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('provider')}</label>
            <select
              className="w-full border-input bg-background border rounded px-3 py-2"
              value={formData.providerConfigId}
              onChange={(e) => setFormData({ ...formData, providerConfigId: e.target.value })}
              required
            >
              <option value="">{t('selectProvider')}</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>{provider.name} ({provider.providerType})</option>
              ))}
            </select>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isDefault"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              className="mr-2"
            />
            <label htmlFor="isDefault" className="text-sm font-medium">{t('setAsDefault')}</label>
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>{t('cancel')}</Button>
            <Button type="submit">{t('grant')}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
