'use client';

import { useMemo, useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminGroupsAPI, type Group, type GroupProviderAccess } from '@/lib/api/admin-groups';
import { adminProvidersAPI } from '@/lib/api/admin-providers';
import { ProviderConfig } from '@/lib/types/provider';
import { Button } from '@/components/ui/button';
import { SkeletonTable } from '@/components/ui/skeleton';
import { useTranslations } from 'next-intl';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

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
    <div className="space-y-6">
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
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-sm font-medium mb-3">{t('groups')}</h2>
            <div className="space-y-1">
              {groups.map((g) => (
                <button
                  key={g.id}
                  className={`
                    w-full text-left px-3 py-2 rounded
                    hover:bg-muted transition-all
                    ${effectiveSelectedGroupId === g.id
                      ? 'bg-muted border-l-4 border-primary pl-2'
                      : 'border-l-4 border-transparent'
                    }
                  `}
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

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition, // 拖拽时禁用过渡，避免不跟手
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-3 p-3 rounded-lg
        ${isDragging
          ? 'bg-primary/10 shadow-lg scale-105 border-2 border-primary z-50 cursor-grabbing'
          : 'bg-muted/30 border-2 border-transparent'
        }
      `}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing hover:text-primary transition-colors"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      {children}
    </div>
  );
}

function GroupAccessPanel({ groupId, providers }: { groupId: string; providers: ProviderConfig[] }) {
  const t = useTranslations('groups');
  const queryClient = useQueryClient();
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());

  // 使用 ref 存储防抖定时器
  const invalidateTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { data: accessList = [], isLoading } = useQuery<GroupProviderAccess[]>({
    queryKey: ['admin', 'groups', groupId, 'access'],
    queryFn: () => adminGroupsAPI.listAccess(groupId),
  });

  const providerMap = useMemo(() => new Map(providers.map((p) => [p.id, p])), [providers]);
  const grantedIds = useMemo(() => new Set(accessList.map((a) => a.providerConfigId)), [accessList]);

  // 防抖的 invalidate 函数
  const debouncedInvalidate = useCallback(() => {
    if (invalidateTimerRef.current) {
      clearTimeout(invalidateTimerRef.current);
    }
    invalidateTimerRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'groups', groupId, 'access'] });
    }, 300); // 300ms 内的多次调用只执行最后一次
  }, [queryClient, groupId]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const grantMutation = useMutation({
    mutationFn: (providerId: string) => adminGroupsAPI.grantAccess(groupId, providerId),
    onMutate: async (providerId) => {
      // 取消正在进行的查询，避免覆盖乐观更新
      await queryClient.cancelQueries({ queryKey: ['admin', 'groups', groupId, 'access'] });

      // 乐观更新：立即添加新的授权记录
      queryClient.setQueryData<GroupProviderAccess[]>(['admin', 'groups', groupId, 'access'], (old) => {
        if (!old) return old;
        // 检查是否已存在，避免重复添加
        if (old.some(a => a.providerConfigId === providerId)) return old;
        // 添加新记录到末尾
        return [...old, {
          id: `temp-${providerId}`, // 临时 ID，服务器返回后会被真实 ID 替换
          groupId,
          providerConfigId: providerId,
          createdAt: new Date().toISOString(),
        }];
      });
    },
    onError: (_err, providerId) => {
      // 发生错误时，移除乐观添加的记录
      queryClient.setQueryData<GroupProviderAccess[]>(['admin', 'groups', groupId, 'access'], (old) => {
        if (!old) return old;
        return old.filter(a => a.providerConfigId !== providerId);
      });
      // 清除 pending 状态
      setPendingChanges((prev) => {
        const next = new Set(prev);
        next.delete(providerId);
        return next;
      });
    },
    onSuccess: (_data, providerId) => {
      // 成功后立即清除 pending 状态
      setPendingChanges((prev) => {
        const next = new Set(prev);
        next.delete(providerId);
        return next;
      });
    },
    onSettled: () => {
      // 使用防抖的 invalidate，避免多个并发请求冲突
      debouncedInvalidate();
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (providerId: string) => adminGroupsAPI.revokeAccess(groupId, providerId),
    onMutate: async (providerId) => {
      // 取消正在进行的查询
      await queryClient.cancelQueries({ queryKey: ['admin', 'groups', groupId, 'access'] });

      // 乐观更新：立即移除授权记录
      queryClient.setQueryData<GroupProviderAccess[]>(['admin', 'groups', groupId, 'access'], (old) => {
        if (!old) return old;
        // 过滤掉被撤销的 provider
        return old.filter(a => a.providerConfigId !== providerId);
      });
    },
    onError: (_err, providerId) => {
      // 发生错误时，重新添加被移除的记录
      queryClient.setQueryData<GroupProviderAccess[]>(['admin', 'groups', groupId, 'access'], (old) => {
        if (!old) return old;
        // 检查是否已存在，避免重复添加
        if (old.some(a => a.providerConfigId === providerId)) return old;
        return [...old, {
          id: `temp-${providerId}`,
          groupId,
          providerConfigId: providerId,
          createdAt: new Date().toISOString(),
        }];
      });
      // 清除 pending 状态
      setPendingChanges((prev) => {
        const next = new Set(prev);
        next.delete(providerId);
        return next;
      });
    },
    onSuccess: (_data, providerId) => {
      // 成功后立即清除 pending 状态
      setPendingChanges((prev) => {
        const next = new Set(prev);
        next.delete(providerId);
        return next;
      });
    },
    onSettled: () => {
      // 使用防抖的 invalidate，避免多个并发请求冲突
      debouncedInvalidate();
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (providerIds: string[]) => adminGroupsAPI.reorder(groupId, providerIds),
    onMutate: async (providerIds) => {
      await queryClient.cancelQueries({ queryKey: ['admin', 'groups', groupId, 'access'] });
      const previous = queryClient.getQueryData<GroupProviderAccess[]>(['admin', 'groups', groupId, 'access']);

      queryClient.setQueryData<GroupProviderAccess[]>(['admin', 'groups', groupId, 'access'], (old) => {
        if (!old) return old;
        const sorted = [...old].sort((a, b) =>
          providerIds.indexOf(a.providerConfigId) - providerIds.indexOf(b.providerConfigId)
        );
        return sorted;
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['admin', 'groups', groupId, 'access'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'groups', groupId, 'access'] });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = accessList.findIndex((a) => a.id === active.id);
      const newIndex = accessList.findIndex((a) => a.id === over.id);

      const newAccessList = arrayMove(accessList, oldIndex, newIndex);
      const providerIds = newAccessList.map((a) => a.providerConfigId);
      reorderMutation.mutate(providerIds);
    }
  };

  const handleProviderToggle = (providerId: string, isCurrentlyGranted: boolean) => {
    // 添加到 pending 状态，防止重复点击
    setPendingChanges((prev) => new Set(prev).add(providerId));

    if (isCurrentlyGranted) {
      revokeMutation.mutate(providerId);
    } else {
      grantMutation.mutate(providerId);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="p-6 border-b border-border">
        <h3 className="text-sm font-medium mb-3">{t('groupAccess')}</h3>
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
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border
                    transition-all cursor-pointer
                    ${isGranted
                      ? 'bg-green-50 dark:bg-green-950/20 border-green-500/50 hover:bg-green-100 dark:hover:bg-green-950/30'
                      : 'border-border hover:bg-muted/50'
                    }
                    ${isPending ? 'opacity-50 pointer-events-none' : ''}
                  `}
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
                  {isGranted && (
                    <div className="text-xs font-medium text-green-600 dark:text-green-400">
                      ✓ {t('granted')}
                    </div>
                  )}
                </label>
              );
            })
          )}
        </div>
      </div>

      {accessList.length > 0 && (
        <div className="p-6">
          <h3 className="text-sm font-medium mb-3">{t('priorityOrder')}</h3>
          <div className={reorderMutation.isPending ? 'pointer-events-none opacity-60' : ''}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={accessList.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {accessList.map((a, index) => {
                    const p = providerMap.get(a.providerConfigId);
                    return (
                      <SortableItem key={a.id} id={a.id}>
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">{p?.name || a.providerConfigId}</div>
                          <div className="text-xs text-muted-foreground">{p?.providerType}</div>
                        </div>
                      </SortableItem>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
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

