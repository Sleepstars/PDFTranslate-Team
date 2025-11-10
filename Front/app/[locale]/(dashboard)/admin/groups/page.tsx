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
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());

  const { data: accessList = [], isLoading } = useQuery<GroupProviderAccess[]>({
    queryKey: ['admin', 'groups', groupId, 'access'],
    queryFn: () => adminGroupsAPI.listAccess(groupId),
  });

  const providerMap = useMemo(() => new Map(providers.map((p) => [p.id, p])), [providers]);
  const grantedIds = useMemo(() => new Set(accessList.map((a) => a.providerConfigId)), [accessList]);

  const grantMutation = useMutation({
    mutationFn: (providerId: string) => adminGroupsAPI.grantAccess(groupId, providerId),
    onSuccess: () => {
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

  const handleProviderToggle = (providerId: string, isCurrentlyGranted: boolean) => {
    setPendingChanges((prev) => new Set(prev).add(providerId));

    if (isCurrentlyGranted) {
      revokeMutation.mutate(providerId, {
        onSettled: () => {
          setPendingChanges((prev) => {
            const next = new Set(prev);
            next.delete(providerId);
            return next;
          });
        },
      });
    } else {
      grantMutation.mutate(providerId, {
        onSettled: () => {
          setPendingChanges((prev) => {
            const next = new Set(prev);
            next.delete(providerId);
            return next;
          });
        },
      });
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-medium mb-3">{t('groupAccess')}</h2>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">{t('loading')}</div>
          ) : providers.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t('noProvidersAvailable')}</div>
          ) : (
            providers.map((provider) => {
              const isGranted = grantedIds.has(provider.id);
              const isPending = pendingChanges.has(provider.id);

              return (
                <label
                  key={provider.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer ${
                    isGranted ? 'bg-primary/5 border-primary/20' : ''
                  } ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isGranted}
                    onChange={() => handleProviderToggle(provider.id, isGranted)}
                    disabled={isPending}
                    className="h-4 w-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{provider.name}</div>
                    <div className="text-xs text-muted-foreground">{provider.providerType}</div>
                  </div>
                  {provider.isDefault && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                      {t('default')}
                    </span>
                  )}
                </label>
              );
            })
          )}
        </div>
      </div>

      {accessList.length > 0 && (
        <div className="p-4">
          <h3 className="text-sm font-medium mb-3">{t('priorityOrder')}</h3>
          <div className="space-y-2">
            {accessList.map((a, index) => {
              const p = providerMap.get(a.providerConfigId);
              return (
                <div key={a.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{p?.name || a.providerConfigId}</div>
                    <div className="text-xs text-muted-foreground">{p?.providerType}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={index === 0 || move.isPending}
                      onClick={() => move.mutate({ from: index, to: index - 1 })}
                      className="h-8 w-8 p-0"
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={index === accessList.length - 1 || move.isPending}
                      onClick={() => move.mutate({ from: index, to: index + 1 })}
                      className="h-8 w-8 p-0"
                    >
                      ↓
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
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

