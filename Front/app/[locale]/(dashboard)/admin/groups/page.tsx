'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminGroupsAPI, type Group, type GroupProviderAccess } from '@/lib/api/admin-groups';
import { adminProvidersAPI } from '@/lib/api/admin-providers';
import { ProviderConfig } from '@/lib/types/provider';
import { Button } from '@/components/ui/button';
import { SkeletonTable } from '@/components/ui/skeleton';
import { useTranslations } from 'next-intl';

export default function AdminGroupsPage() {
  const t = useTranslations('groups');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: groups = [], isLoading: loadingGroups } = useQuery<Group[]>({
    queryKey: ['admin', 'groups'],
    queryFn: adminGroupsAPI.list,
  });

  const { data: providers = [] } = useQuery<ProviderConfig[]>({
    queryKey: ['admin', 'providers'],
    queryFn: adminProvidersAPI.list,
  });

  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  // Derive the effective selected group ID
  const effectiveSelectedGroupId = selectedGroupId || groups[0]?.id || '';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <Button size="sm" className="h-9" onClick={() => setShowCreateDialog(true)}>
          + {t('create')}
        </Button>
      </div>

      {loadingGroups ? (
        <SkeletonTable rows={5} columns={4} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-lg p-3">
            <h2 className="text-sm font-medium mb-2">{t('groups')}</h2>
            <div className="space-y-1">
              {groups.map((g) => (
                <button
                  key={g.id}
                  className={`w-full text-left px-3 py-2 rounded hover:bg-muted transition-colors ${effectiveSelectedGroupId === g.id ? 'bg-muted' : ''}`}
                  onClick={() => setSelectedGroupId(g.id)}
                >
                  <div className="text-sm font-medium">{g.name}</div>
                  <div className="text-xs text-muted-foreground">{new Date(g.createdAt).toLocaleString()}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            {effectiveSelectedGroupId ? (
              <GroupAccessPanel groupId={effectiveSelectedGroupId} providers={providers as ProviderConfig[]} />
            ) : (
              <div className="bg-card border border-border rounded-lg p-6 text-sm text-muted-foreground">{t('selectGroup')}</div>
            )}
          </div>
        </div>
      )}

      {showCreateDialog && (
        <CreateGroupDialog onClose={() => setShowCreateDialog(false)} />
      )}
    </div>
  );
}

function GroupAccessPanel({ groupId, providers }: { groupId: string; providers: ProviderConfig[] }) {
  const t = useTranslations('groups');
  const queryClient = useQueryClient();
  const [selectedProviderId, setSelectedProviderId] = useState('');

  const { data: accessList = [], isLoading } = useQuery<GroupProviderAccess[]>({
    queryKey: ['admin', 'groups', groupId, 'access'],
    queryFn: () => adminGroupsAPI.listAccess(groupId),
  });

  const providerMap = useMemo(() => new Map(providers.map((p) => [p.id, p])), [providers]);
  const grantedIds = useMemo(() => new Set(accessList.map((a) => a.providerConfigId)), [accessList]);
  const availableProviders = useMemo(() => providers.filter((p) => !grantedIds.has(p.id)), [providers, grantedIds]);

  const grantMutation = useMutation({
    mutationFn: () => adminGroupsAPI.grantAccess(groupId, selectedProviderId),
    onSuccess: () => {
      setSelectedProviderId('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'groups', groupId, 'access'] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (providerId: string) => adminGroupsAPI.revokeAccess(groupId, providerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'groups', groupId, 'access'] });
    },
  });

  const move = useMutation({
    mutationFn: (payload: { from: number; to: number }) => {
      const next = [...accessList];
      const [item] = next.splice(payload.from, 1);
      next.splice(payload.to, 0, item);
      const providerIds = next.map((a) => a.providerConfigId);
      return adminGroupsAPI.reorder(groupId, providerIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'groups', groupId, 'access'] });
    },
  });

  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <h2 className="text-sm font-medium flex-1">{t('groupAccess')}</h2>
        <div className="flex items-center gap-2">
          <select
            className="border border-input bg-background rounded px-3 py-2 text-sm"
            value={selectedProviderId}
            onChange={(e) => setSelectedProviderId(e.target.value)}
          >
            <option value="">{t('selectProvider')}</option>
            {availableProviders.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.providerType})
              </option>
            ))}
          </select>
          <Button size="sm" disabled={!selectedProviderId || grantMutation.isPending} onClick={() => grantMutation.mutate()}> 
            {t('addProvider')}
          </Button>
        </div>
      </div>
      <div className="divide-y divide-border">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">{t('loading')}</div>
        ) : accessList.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">{t('noProviders')}</div>
        ) : (
          accessList.map((a, index) => {
            const p = providerMap.get(a.providerConfigId);
            return (
              <div key={a.id} className="p-4 flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-sm font-medium">{p?.name || a.providerConfigId}</div>
                  <div className="text-xs text-muted-foreground">{p?.providerType}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={index === 0 || move.isPending} onClick={() => move.mutate({ from: index, to: index - 1 })}>
                    {t('moveUp')}
                  </Button>
                  <Button variant="outline" size="sm" disabled={index === accessList.length - 1 || move.isPending} onClick={() => move.mutate({ from: index, to: index + 1 })}>
                    {t('moveDown')}
                  </Button>
                  <Button variant="destructive" size="sm" disabled={revokeMutation.isPending} onClick={() => revokeMutation.mutate(a.providerConfigId)}>
                    {t('remove')}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function CreateGroupDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations('groups.createDialog');
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const createMutation = useMutation({
    mutationFn: () => adminGroupsAPI.create(name.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'groups'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">{t('title')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('name')}</label>
            <input
              className="w-full border-input bg-background border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>{t('cancel')}</Button>
            <Button type="submit" disabled={createMutation.isPending || !name.trim()}>{t('create')}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

