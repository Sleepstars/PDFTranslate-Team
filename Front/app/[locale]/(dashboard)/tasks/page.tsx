'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksAPI } from '@/lib/api/tasks';
import { usersAPI } from '@/lib/api/users';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonTable } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Task, TasksListResponse } from '@/lib/types/task';
import { ProviderConfig } from '@/lib/types/provider';
import { useTaskUpdates } from '@/lib/hooks/use-task-updates';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { FileText, Upload, Download, Trash2 } from 'lucide-react';
import { Portal } from '@/components/ui/portal';
import { useDropzone } from 'react-dropzone';

export default function TasksPage() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; id: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isRealtimeConnected = useTaskUpdates();
  const refetchOnWindowFocus = !isRealtimeConnected;
  const refetchInterval = isRealtimeConnected ? false : 4000;
  const selectAllRef = useRef<HTMLInputElement>(null);
  const t = useTranslations('tasks');

  const getStatusText = (status: string) => {
    return t(`status.${status}`) || status;
  };

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksAPI.list(),
    refetchOnWindowFocus,
    refetchInterval,
  });

  const { data: providersData = [] } = useQuery({
    queryKey: ['users', 'providers'],
    queryFn: usersAPI.getProviders,
  });

  const providers = useMemo(() => (providersData as ProviderConfig[]) || [], [providersData]);

  const providerMap = useMemo(() => {
    const map = new Map<string, ProviderConfig>();
    providers.forEach((provider) => {
      map.set(provider.id, provider);
    });
    return map;
  }, [providers]);

  const cancelMutation = useMutation({
    mutationFn: tasksAPI.cancel,
    onMutate: async (taskId) => {
      // 取消正在进行的查询
      await queryClient.cancelQueries({ queryKey: ['tasks'] });

      // 保存之前的数据用于回滚
      const previousTasks = queryClient.getQueryData(['tasks']);

      // 乐观更新:立即更新任务状态为 cancelled
      queryClient.setQueryData(['tasks'], (old: TasksListResponse | undefined) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks.map(task =>
            task.id === taskId ? { ...task, status: 'cancelled' as const } : task
          ),
        };
      });

      return { previousTasks };
    },
    onSuccess: () => {
      toast.success(t('cancelSuccess'));
    },
    onError: (_err, _taskId, context) => {
      // 失败时回滚
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks'], context.previousTasks);
      }
      toast.error(t('cancelError'));
    },
    onSettled: () => {
      // 最终同步服务器数据
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: tasksAPI.retry,
    onMutate: async (taskId) => {
      // 取消正在进行的查询
      await queryClient.cancelQueries({ queryKey: ['tasks'] });

      // 保存之前的数据用于回滚
      const previousTasks = queryClient.getQueryData(['tasks']);

      // 乐观更新:立即更新任务状态为 pending
      queryClient.setQueryData(['tasks'], (old: TasksListResponse | undefined) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks.map(task =>
            task.id === taskId ? { ...task, status: 'pending' as const, progress: 0 } : task
          ),
        };
      });

      return { previousTasks };
    },
    onSuccess: () => {
      toast.success(t('retrySuccess'));
    },
    onError: (_err, _taskId, context) => {
      // 失败时回滚
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks'], context.previousTasks);
      }
      toast.error(t('retryError'));
    },
    onSettled: () => {
      // 最终同步服务器数据
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const tasks = useMemo(() => tasksData?.tasks || [], [tasksData?.tasks]);

  useEffect(() => {
    setSelectedTaskIds((prev) => {
      const validIds = new Set(tasks.map((task) => task.id));
      const next = new Set(Array.from(prev).filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [tasks]);

  const allSelected = tasks.length > 0 && tasks.every((task) => selectedTaskIds.has(task.id));
  const hasSelection = selectedTaskIds.size > 0;

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = hasSelection && !allSelected;
  }, [hasSelection, allSelected]);

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleSelectAllToggle = () => {
    if (!tasks.length) {
      setSelectedTaskIds(new Set());
      return;
    }
    setSelectedTaskIds((prev) => {
      const currentAllSelected = tasks.every((task) => prev.has(task.id));
      return currentAllSelected ? new Set() : new Set(tasks.map((task) => task.id));
    });
  };

  const handleBulkDownload = async () => {
    if (!hasSelection) return;

    const selectedTasks = tasks.filter(task => selectedTaskIds.has(task.id));
    const completedTasks = selectedTasks.filter(task => task.status === 'completed');

    if (completedTasks.length === 0) {
      toast.error(t('noCompletedTasks'));
      return;
    }

    const downloads: Array<{ url: string; filename: string }> = [];
    completedTasks.forEach(task => {
      let url = '';
      let filename = '';

      if (task.taskType === 'parsing') {
        url = task.markdownOutputUrl || '';
        filename = `${task.documentName}.md`;
      } else if (task.taskType === 'translation') {
        url = task.dualOutputUrl || task.monoOutputUrl || task.outputUrl || '';
        filename = `${task.documentName}.pdf`;
      } else if (task.taskType === 'parse_and_translate') {
        url = task.translatedMarkdownUrl || task.dualOutputUrl || task.monoOutputUrl || task.outputUrl || '';
        filename = task.translatedMarkdownUrl ? `${task.documentName}.md` : `${task.documentName}.pdf`;
      }

      if (url) downloads.push({ url, filename });
    });

    if (downloads.length === 0) {
      toast.error(t('noDownloadableFiles'));
      return;
    }

    toast.success(t('downloadSuccess', { count: downloads.length }));

    for (let i = 0; i < downloads.length; i++) {
      await new Promise(resolve => setTimeout(resolve, i * 200));
      const { url, filename } = downloads[i];
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } catch (error) {
        console.error(`Failed to download ${filename}:`, error);
      }
    }
  };

  const confirmBulkDelete = async () => {
    if (!hasSelection) return;
    const count = selectedTaskIds.size;

    // 乐观更新:立即从 UI 中移除选中的任务
    await queryClient.cancelQueries({ queryKey: ['tasks'] });
    const previousTasks = queryClient.getQueryData(['tasks']);

    queryClient.setQueryData(['tasks'], (old: TasksListResponse | undefined) => {
      if (!old) return old;
      return {
        ...old,
        tasks: old.tasks.filter(task => !selectedTaskIds.has(task.id)),
      };
    });

    setSelectedTaskIds(new Set());
    setIsDeleting(true);
    setShowDeleteConfirm(false);

    try {
      // 后台执行删除操作
      await Promise.all(Array.from(selectedTaskIds).map((id) => tasksAPI.delete(id)));
      toast.success(count === 1 ? t('deleteSuccess') : t('bulkDeleteSuccess', { count }));
    } catch (error) {
      console.error('Failed to delete tasks', error);
      // 失败时回滚
      if (previousTasks) {
        queryClient.setQueryData(['tasks'], previousTasks);
      }
      toast.error(t('deleteError'));
    } finally {
      setIsDeleting(false);
      // 最终同步服务器数据
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">{t('title')}</h1>
        </div>
        <SkeletonTable rows={8} columns={9} />
      </div>
    );
  }

  return (
    <div className="section-spacing">
      <div className="page-header">
        <h1 className="page-title">{t('title')}</h1>
        <p className="page-subtitle">{t('subtitle')}</p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button onClick={() => setShowDialog(true)} size="sm" className="h-9">
            + {t('create')}
          </Button>
          <Button variant="outline" onClick={() => setShowBatchDialog(true)} size="sm" className="h-9">
            {t('batch')}
          </Button>
        </div>

        {hasSelection && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selectedTaskIds.size} {t('selected')}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDownload}
              className="h-9 gap-1.5"
            >
              <Download className="h-4 w-4" />
              {t('bulkDownload')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="h-9 gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? t('deleting') : t('delete')}
            </Button>
          </div>
        )}
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t('emptyState.title')}
          description={t('emptyState.description')}
          actionLabel={t('emptyState.action')}
          onAction={() => setShowDialog(true)}
        />
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {tasks.map((task: Task) => (
              <div key={task.id} className="card-elevated p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-primary flex-shrink-0"
                      onChange={() => toggleTaskSelection(task.id)}
                      checked={selectedTaskIds.has(task.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">{task.documentName}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {task.sourceLang} → {task.targetLang}
                      </p>
                    </div>
                  </div>
                  <Badge variant={
                    task.status === 'completed' ? 'success' :
                    task.status === 'failed' ? 'error' :
                    task.status === 'processing' ? 'info' :
                    task.status === 'cancelled' ? 'secondary' :
                    'warning'
                  } className="text-xs flex-shrink-0">
                    {getStatusText(task.status)}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">{task.progress}%</span>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span>{providerMap.get(task.providerConfigId || '')?.name || task.engine}</span>
                    <span>{task.pageCount} {t('pages')}</span>
                  </div>
                  <span>{new Date(task.createdAt).toLocaleDateString()}</span>
                </div>

                <div className="flex gap-2 pt-2 border-t border-border">
                  <button
                    onClick={() => setDetailTask(task)}
                    className="flex-1 px-3 py-1.5 text-xs bg-accent hover:bg-accent/80 rounded-md transition-colors"
                  >
                    {t('view')}
                  </button>
                  {task.status === 'processing' && (
                    <button
                      onClick={() => cancelMutation.mutate(task.id)}
                      className="flex-1 px-3 py-1.5 text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-md transition-colors"
                      disabled={cancelMutation.isPending}
                    >
                      {t('cancel')}
                    </button>
                  )}
                  {task.status === 'failed' && (
                    <button
                      onClick={() => retryMutation.mutate(task.id)}
                      className="flex-1 px-3 py-1.5 text-xs bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
                      disabled={retryMutation.isPending}
                    >
                      {t('retry')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block card-elevated overflow-x-auto">
            <table className="w-full min-w-[800px]">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium w-12">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    className="h-4 w-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-primary"
                    onChange={handleSelectAllToggle}
                    checked={tasks.length > 0 && allSelected}
                  />
                </th>
                <th className="px-4 py-2.5 text-left font-medium min-w-[200px]">{t('document')}</th>
                <th className="px-4 py-2.5 text-left font-medium">{t('languages')}</th>
                <th className="px-4 py-2.5 text-left font-medium">{t('engine')}</th>
                <th className="px-4 py-2.5 text-left font-medium">{t('statusLabel')}</th>
                <th className="px-4 py-2.5 text-left font-medium w-[120px]">{t('progress')}</th>
                <th className="px-4 py-2.5 text-left font-medium">{t('pages')}</th>
                <th className="px-4 py-2.5 text-left font-medium">{t('created')}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tasks.map((task: Task) => (
              <tr key={task.id} className="hover:bg-muted/50 transition-all duration-200 hover:shadow-sm">
                <td className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-primary"
                    onChange={() => toggleTaskSelection(task.id)}
                    checked={selectedTaskIds.has(task.id)}
                  />
                </td>
                <td className="px-4 py-2.5 text-sm font-medium">{task.documentName}</td>
                <td className="px-4 py-2.5 text-sm whitespace-nowrap">
                  {task.sourceLang} → {task.targetLang}
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant="info" className="text-xs">{providerMap.get(task.providerConfigId || '')?.name || task.engine}</Badge>
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant={
                    task.status === 'completed' ? 'success' :
                    task.status === 'failed' ? 'error' :
                    task.status === 'processing' ? 'info' :
                    task.status === 'cancelled' ? 'secondary' :
                    'warning'
                  } className="text-xs">
                    {getStatusText(task.status)}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground min-w-[2.5rem] tabular-nums">{task.progress}%</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-sm">{task.pageCount}</td>
                <td className="px-4 py-2.5 text-sm text-muted-foreground whitespace-nowrap">
                  {new Date(task.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={(e) => {
                      const isOpen = activeMenu === task.id;
                      if (isOpen) {
                        setActiveMenu(null);
                        setMenuPos(null);
                        return;
                      }
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      // Menu width = w-40 = 160px
                      const menuWidth = 160;
                      const left = Math.min(
                        Math.max(8, rect.right - menuWidth),
                        window.innerWidth - 8 - menuWidth,
                      );
                      const top = Math.min(rect.bottom + 4, window.innerHeight - 8);
                      setMenuPos({ top, left, id: task.id });
                      setActiveMenu(task.id);
                    }}
                    className="p-1 hover:bg-muted rounded transition-colors"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
                      <circle cx="8" cy="2" r="1.5"/>
                      <circle cx="8" cy="8" r="1.5"/>
                      <circle cx="8" cy="14" r="1.5"/>
                    </svg>
                  </button>
                  {activeMenu === task.id && menuPos?.id === task.id && (
                    <Portal>
                      <div className="fixed inset-0 z-[60]" onClick={() => { setActiveMenu(null); setMenuPos(null); }} />
                      <div className="fixed z-[61] w-40 bg-popover border border-border rounded-md shadow-lg" style={{ top: menuPos.top, left: menuPos.left }}>
                        <button
                          onClick={() => {
                            setDetailTask(task);
                            setActiveMenu(null);
                            setMenuPos(null);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                        >
                          {t('detail')}
                        </button>
                        {task.inputUrl && (
                          <button
                            onClick={() => {
                              window.open(task.inputUrl!, '_blank');
                              setActiveMenu(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                          >
                            {t('downloadOriginal')}
                          </button>
                        )}
                        {task.status === 'completed' && task.dualOutputUrl && (
                          <button
                            onClick={() => {
                              window.open(task.dualOutputUrl!, '_blank');
                              setActiveMenu(null);
                              setMenuPos(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                          >
                            {t('downloadDual')}
                          </button>
                        )}
                        {task.status === 'completed' && task.monoOutputUrl && (
                          <button
                            onClick={() => {
                              window.open(task.monoOutputUrl!, '_blank');
                              setActiveMenu(null);
                              setMenuPos(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                          >
                            {t('downloadMono')}
                          </button>
                        )}
                        {task.status === 'completed' && !task.dualOutputUrl && !task.monoOutputUrl && task.outputUrl && (
                          <button
                            onClick={() => {
                              window.open(task.outputUrl!, '_blank');
                              setActiveMenu(null);
                              setMenuPos(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                          >
                            {t('download')}
                          </button>
                        )}
                        {task.status === 'completed' && task.zipOutputUrl && (
                          <button
                            onClick={() => {
                              window.open(task.zipOutputUrl!, '_blank');
                              setActiveMenu(null);
                              setMenuPos(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                          >
                            {t('downloadZip')}
                          </button>
                        )}
                        {task.status === 'completed' && task.markdownOutputUrl && (
                          <button
                            onClick={() => {
                              window.open(task.markdownOutputUrl!, '_blank');
                              setActiveMenu(null);
                              setMenuPos(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                          >
                            {t('downloadMarkdown')}
                          </button>
                        )}
                        {task.status === 'processing' && (
                          <button
                            onClick={() => {
                              cancelMutation.mutate(task.id);
                              setActiveMenu(null);
                              setMenuPos(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                          >
                            {t('cancel')}
                          </button>
                        )}
                        {(task.status === 'failed' || task.status === 'canceled' || task.status === 'cancelled') && (
                          <button
                            onClick={() => {
                              retryMutation.mutate(task.id);
                              setActiveMenu(null);
                              setMenuPos(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                          >
                            {t('retry')}
                          </button>
                        )}
                      </div>
                    </Portal>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        </>
      )}

      {showDialog && <CreateTaskDialog providers={providers} onClose={() => setShowDialog(false)} />}
      {showBatchDialog && <BatchUploadDialog providers={providers} onClose={() => setShowBatchDialog(false)} />}
      {detailTask && <TaskDetailDialog task={detailTask} providerName={providerMap.get(detailTask.providerConfigId || '')?.name} onClose={() => setDetailTask(null)} />}

      {showDeleteConfirm && (
        <ConfirmDialog
          title={t('confirmDelete.title')}
          description={t('confirmDelete.description', { count: selectedTaskIds.size })}
          confirmLabel={t('confirmDelete.confirm')}
          cancelLabel={t('confirmDelete.cancel')}
          variant="destructive"
          onConfirm={confirmBulkDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

function TaskDetailDialog({ task, providerName, onClose }: { task: Task; providerName?: string; onClose: () => void }) {
  const t = useTranslations('tasks');

  const getStatusText = (status: string) => {
    return t(`status.${status}`) || status;
  };
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{t('taskDetails')}</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('document')}</label>
              <p className="text-sm mt-1">{task.documentName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('status')}</label>
              <div className="mt-1">
                <Badge variant={
                  task.status === 'completed' ? 'success' :
                  task.status === 'failed' ? 'error' :
                  task.status === 'processing' ? 'info' :
                  task.status === 'cancelled' ? 'secondary' :
                  'warning'
                } className="text-xs">
                  {getStatusText(task.status)}
                </Badge>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('languages')}</label>
              <p className="text-sm mt-1">{task.sourceLang} → {task.targetLang}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('engine')}</label>
              <p className="text-sm mt-1">{providerName || task.engine}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('progress')}</label>
              <div className="mt-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  <span className="text-sm">{task.progress}%</span>
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('pages')}</label>
              <p className="text-sm mt-1">{task.pageCount}</p>
            </div>
          </div>
          {task.progressMessage && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('progressMessage')}</label>
              <p className="text-sm mt-1">{task.progressMessage}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('createdAt')}</label>
              <p className="text-sm mt-1">{new Date(task.createdAt).toLocaleString()}</p>
            </div>
            {task.completedAt && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('completedAt')}</label>
                <p className="text-sm mt-1">{new Date(task.completedAt).toLocaleString()}</p>
              </div>
            )}
          </div>
          {task.notes && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('notes')}</label>
              <p className="text-sm mt-1">{task.notes}</p>
            </div>
          )}
        </div>
        <div className="flex justify-between mt-6">
          <div className="flex gap-2">
            {task.inputUrl && (
              <Button variant="outline" size="sm" onClick={() => window.open(task.inputUrl!, '_blank')}>
                {t('downloadOriginal')}
              </Button>
            )}
            {task.status === 'completed' && task.dualOutputUrl && (
              <Button variant="outline" size="sm" onClick={() => window.open(task.dualOutputUrl!, '_blank')}>
                {t('downloadDual')}
              </Button>
            )}
            {task.status === 'completed' && task.monoOutputUrl && (
              <Button variant="outline" size="sm" onClick={() => window.open(task.monoOutputUrl!, '_blank')}>
                {t('downloadMono')}
              </Button>
            )}
            {task.status === 'completed' && !task.dualOutputUrl && !task.monoOutputUrl && task.outputUrl && (
              <Button variant="outline" size="sm" onClick={() => window.open(task.outputUrl!, '_blank')}>
                {t('download')}
              </Button>
            )}
            {task.status === 'completed' && task.zipOutputUrl && (
              <Button variant="outline" size="sm" onClick={() => window.open(task.zipOutputUrl!, '_blank')}>
                {t('downloadZip')}
              </Button>
            )}
            {task.status === 'completed' && task.markdownOutputUrl && (
              <Button variant="outline" size="sm" onClick={() => window.open(task.markdownOutputUrl!, '_blank')}>
                {t('downloadMarkdown')}
              </Button>
            )}
          </div>
          <Button onClick={onClose} size="sm">{t('close')}</Button>
        </div>
      </div>
    </div>
  );
}

function CreateTaskDialog({ onClose, providers }: { onClose: () => void; providers: ProviderConfig[] }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [translateAfterParsing, setTranslateAfterParsing] = useState(false);
  const t = useTranslations('tasks.createDialog');

  // Compute default translation provider
  const translationProviders = useMemo(() => providers.filter((p) => p.providerType !== 'mineru'), [providers]);
  const defaultTranslation = useMemo(() => translationProviders.find((p) => p.isDefault) || translationProviders[0], [translationProviders]);

  const [formData, setFormData] = useState({
    documentName: '',
    taskType: 'translation' as 'translation' | 'parsing',
    sourceLang: 'en',
    targetLang: 'zh',
    engine: defaultTranslation?.providerType || 'openai',
    priority: 'normal' as 'normal' | 'high',
    notes: '',
    providerConfigId: defaultTranslation?.id || '',
    translationProviderConfigId: '', // 用于解析任务的翻译提供商
  });

  const createMutation = useMutation({
    mutationFn: tasksAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'quota'] });
      toast.success(t('createSuccess'));
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error?.message || t('createError'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    // 根据任务类型和勾选状态构建请求
    let taskType: 'translation' | 'parsing' | 'parse_and_translate';
    let providerConfigId: string;

    if (formData.taskType === 'translation') {
      taskType = 'translation';
      providerConfigId = formData.providerConfigId;
    } else if (formData.taskType === 'parsing' && translateAfterParsing) {
      taskType = 'parse_and_translate';
      providerConfigId = formData.translationProviderConfigId;
    } else {
      taskType = 'parsing';
      providerConfigId = formData.providerConfigId;
    }

    createMutation.mutate({
      file,
      documentName: formData.documentName,
      taskType,
      sourceLang: formData.sourceLang,
      targetLang: formData.targetLang,
      engine: formData.engine,
      priority: formData.priority,
      notes: formData.notes,
      providerConfigId,
    });
  };

  const onDrop = (acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!formData.documentName) {
        setFormData({ ...formData, documentName: selectedFile.name.replace('.pdf', '') });
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    noClick: false,
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center overflow-y-auto z-50">
      <div className="bg-card rounded-lg p-6 w-full max-w-2xl my-8 border border-border">
        <h2 className="text-xl font-bold mb-4">{t('title')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">{t('pdfFile')}</label>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : file
                  ? 'border-success bg-success/5'
                  : 'border-border hover:border-primary/50 hover:bg-accent/50'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              {file ? (
                <div>
                  <p className="text-sm font-medium text-success mb-1">✓ {file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : isDragActive ? (
                <p className="text-sm text-primary">{t('dropHere')}</p>
              ) : (
                <div>
                  <p className="text-sm font-medium mb-1">{t('dragDrop')}</p>
                  <p className="text-xs text-muted-foreground">{t('orClickToSelect')}</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('documentName')}</label>
            <input
              type="text"
              className="w-full border border-input rounded px-3 py-2 bg-background"
              value={formData.documentName}
              onChange={(e) => setFormData({ ...formData, documentName: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('taskType')}</label>
            <select
              className="w-full border border-input rounded px-3 py-2 bg-background"
              value={formData.taskType}
              onChange={(e) => {
                const newTaskType = e.target.value as 'translation' | 'parsing';
                setFormData({ ...formData, taskType: newTaskType });
                // 切换到解析任务时，重置翻译选项
                if (newTaskType === 'parsing') {
                  setTranslateAfterParsing(false);
                }
              }}
            >
              <option value="translation">{t('pdfTranslation')}</option>
              <option value="parsing">{t('pdfParsing')}</option>
            </select>
          </div>

          {/* PDF 解析任务的额外选项 */}
          {formData.taskType === 'parsing' && (
            <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-md">
              <input
                type="checkbox"
                id="translateAfterParsing"
                checked={translateAfterParsing}
                onChange={(e) => setTranslateAfterParsing(e.target.checked)}
                className="w-4 h-4 rounded border-input"
              />
              <label htmlFor="translateAfterParsing" className="text-sm font-medium cursor-pointer">
                {t('translateMarkdownAfterParsing')}
              </label>
            </div>
          )}

          {/* 翻译任务或解析后翻译时显示语言选择 */}
          {(formData.taskType === 'translation' || (formData.taskType === 'parsing' && translateAfterParsing)) && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('sourceLanguage')}</label>
                <select
                  className="w-full border border-input rounded px-3 py-2 bg-background"
                  value={formData.sourceLang}
                  onChange={(e) => setFormData({ ...formData, sourceLang: e.target.value })}
                >
                  <option value="en">{t('english')}</option>
                  <option value="zh">{t('chinese')}</option>
                  <option value="ja">{t('japanese')}</option>
                  <option value="ko">{t('korean')}</option>
                  <option value="fr">{t('french')}</option>
                  <option value="de">{t('german')}</option>
                  <option value="es">{t('spanish')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('targetLanguage')}</label>
                <select
                  className="w-full border border-input rounded px-3 py-2 bg-background"
                  value={formData.targetLang}
                  onChange={(e) => setFormData({ ...formData, targetLang: e.target.value })}
                >
                  <option value="zh">{t('chinese')}</option>
                  <option value="en">{t('english')}</option>
                  <option value="ja">{t('japanese')}</option>
                  <option value="ko">{t('korean')}</option>
                  <option value="fr">{t('french')}</option>
                  <option value="de">{t('german')}</option>
                  <option value="es">{t('spanish')}</option>
                </select>
              </div>
            </div>
          )}

          {/* 解析服务提供商（仅解析任务） */}
          {formData.taskType === 'parsing' && (
            <div>
              <label className="block text-sm font-medium mb-1">{t('parsingProvider')}</label>
              <select
                className="w-full border border-input rounded px-3 py-2 bg-background"
                value={formData.providerConfigId}
                onChange={(e) => {
                  const provider = providers.find((p) => p.id === e.target.value);
                  setFormData({
                    ...formData,
                    providerConfigId: e.target.value,
                    engine: provider?.providerType || 'mineru',
                  });
                }}
                required
              >
                <option value="">{t('selectProvider')}</option>
                {providers
                  .filter((provider) => provider.providerType === 'mineru')
                  .map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name} ({provider.providerType})
                      {provider.isDefault && ` ${t('default')}`}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* 翻译服务提供商（翻译任务或解析后翻译） */}
          {(formData.taskType === 'translation' || (formData.taskType === 'parsing' && translateAfterParsing)) && (
            <div>
              <label className="block text-sm font-medium mb-1">{t('translationProvider')}</label>
              <select
                className="w-full border border-input rounded px-3 py-2 bg-background"
                value={formData.taskType === 'translation' ? formData.providerConfigId : formData.translationProviderConfigId}
                onChange={(e) => {
                  const provider = providers.find((p) => p.id === e.target.value);
                  if (formData.taskType === 'translation') {
                    setFormData({
                      ...formData,
                      providerConfigId: e.target.value,
                      engine: provider?.providerType || 'openai',
                    });
                  } else {
                    // 解析后翻译，保存到单独的字段
                    setFormData({
                      ...formData,
                      translationProviderConfigId: e.target.value,
                    });
                  }
                }}
                required
              >
                <option value="">{t('selectProvider')}</option>
                {providers
                  .filter((provider) => provider.providerType !== 'mineru')
                  .map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name} ({provider.providerType})
                      {provider.isDefault && ` ${t('default')}`}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">{t('priority')}</label>
            <select
              className="w-full border border-input rounded px-3 py-2 bg-background"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'normal' | 'high' })}
            >
              <option value="normal">{t('normal')}</option>
              <option value="high">{t('high')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('notes')} ({t('optional')})</label>
            <textarea
              className="w-full border border-input rounded px-3 py-2 bg-background"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>{t('cancel')}</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? t('creating') : t('create')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BatchUploadDialog({ onClose, providers }: { onClose: () => void; providers: ProviderConfig[] }) {
  const queryClient = useQueryClient();
  const [entries, setEntries] = useState<Array<{ id: string; file: File; documentName: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [translateAfterParsing, setTranslateAfterParsing] = useState(false);
  const t = useTranslations('tasks.batchDialog');
  const tCreate = useTranslations('tasks.createDialog');

  // Compute default translation provider
  const translationProviders = useMemo(() => providers.filter((p) => p.providerType !== 'mineru'), [providers]);
  const defaultTranslation = useMemo(() => translationProviders.find((p) => p.isDefault) || translationProviders[0], [translationProviders]);

  const [formData, setFormData] = useState({
    taskType: 'translation' as 'translation' | 'parsing',
    sourceLang: 'en',
    targetLang: 'zh',
    engine: defaultTranslation?.providerType || 'openai',
    priority: 'normal' as 'normal' | 'high',
    notes: '',
    providerConfigId: defaultTranslation?.id || '',
    translationProviderConfigId: '', // 用于解析任务的翻译提供商
  });

  const batchMutation = useMutation({
    mutationFn: tasksAPI.createBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'quota'] });
      onClose();
    },
    onError: (error: Error) => {
      // Show server-provided detail, including quota exceeded message
      toast.error(error?.message || t('creating'));
    },
  });

  const onDrop = (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;
    setEntries((prev) => [
      ...prev,
      ...acceptedFiles.map((file, index) => ({
        id: `${file.name}-${Date.now()}-${index}`,
        file,
        documentName: file.name.replace(/\.pdf$/i, ''),
      })),
    ]);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
    noClick: false,
  });

  const updateDocumentName = (id: string, value: string) => {
    setEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, documentName: value } : entry)));
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entries.length) {
      setError('Please select at least one PDF file.');
      return;
    }
    if (entries.some((entry) => !entry.documentName.trim())) {
      setError('Each file requires a document name.');
      return;
    }
    setError(null);

    // 根据任务类型和勾选状态构建请求
    let taskType: 'translation' | 'parsing' | 'parse_and_translate';
    let providerConfigId: string;

    if (formData.taskType === 'translation') {
      taskType = 'translation';
      providerConfigId = formData.providerConfigId;
    } else if (formData.taskType === 'parsing' && translateAfterParsing) {
      taskType = 'parse_and_translate';
      providerConfigId = formData.translationProviderConfigId;
    } else {
      taskType = 'parsing';
      providerConfigId = formData.providerConfigId;
    }

    batchMutation.mutate({
      files: entries.map((entry) => entry.file),
      documentNames: entries.map((entry) => entry.documentName.trim()),
      taskType,
      sourceLang: formData.sourceLang || undefined,
      targetLang: formData.targetLang || undefined,
      engine: formData.engine || undefined,
      priority: formData.priority,
      notes: formData.notes || undefined,
      providerConfigId: providerConfigId || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center overflow-y-auto z-50">
      <div className="bg-card rounded-lg p-6 w-full max-w-3xl my-8 border border-border">
        <h2 className="text-xl font-bold mb-4">{t('title')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">{t('selectFiles')}</label>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : entries.length > 0
                  ? 'border-success bg-success/5'
                  : 'border-border hover:border-primary/50 hover:bg-accent/50'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              {entries.length > 0 ? (
                <div>
                  <p className="text-sm font-medium text-success mb-1">✓ {entries.length} {t('filesSelected')}</p>
                  <p className="text-xs text-muted-foreground">{t('dragMoreFiles')}</p>
                </div>
              ) : isDragActive ? (
                <p className="text-sm text-primary">{tCreate('dropHere')}</p>
              ) : (
                <div>
                  <p className="text-sm font-medium mb-1">{tCreate('dragDrop')}</p>
                  <p className="text-xs text-muted-foreground">{tCreate('orClickToSelect')}</p>
                </div>
              )}
            </div>
          </div>

          {entries.length > 0 && (
            <div className="border border-border rounded max-h-60 overflow-auto divide-y divide-border">
              {entries.map((entry, index) => (
                <div key={entry.id} className="flex items-center p-3 gap-3">
                  <div className="text-sm font-medium w-10">{index + 1}.</div>
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">{entry.file.name}</div>
                    <input
                      type="text"
                      className="w-full border border-input rounded px-3 py-2 bg-background mt-1"
                      value={entry.documentName}
                      onChange={(e) => updateDocumentName(entry.id, e.target.value)}
                      placeholder={t('documentName')}
                      required
                    />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => removeEntry(entry.id)}>
                    {t('remove')}
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">{tCreate('taskType')}</label>
            <select
              className="w-full border border-input rounded px-3 py-2 bg-background"
              value={formData.taskType}
              onChange={(e) => {
                const newTaskType = e.target.value as 'translation' | 'parsing';
                setFormData({ ...formData, taskType: newTaskType });
                // 切换到解析任务时，重置翻译选项
                if (newTaskType === 'parsing') {
                  setTranslateAfterParsing(false);
                }
              }}
            >
              <option value="translation">{tCreate('pdfTranslation')}</option>
              <option value="parsing">{tCreate('pdfParsing')}</option>
            </select>
          </div>

          {/* PDF 解析任务的额外选项 */}
          {formData.taskType === 'parsing' && (
            <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-md">
              <input
                type="checkbox"
                id="batchTranslateAfterParsing"
                checked={translateAfterParsing}
                onChange={(e) => setTranslateAfterParsing(e.target.checked)}
                className="w-4 h-4 rounded border-input"
              />
              <label htmlFor="batchTranslateAfterParsing" className="text-sm font-medium cursor-pointer">
                {tCreate('translateMarkdownAfterParsing')}
              </label>
            </div>
          )}

          {/* 翻译任务或解析后翻译时显示语言选择 */}
          {(formData.taskType === 'translation' || (formData.taskType === 'parsing' && translateAfterParsing)) && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{tCreate('sourceLanguage')}</label>
                <select
                  className="w-full border border-input rounded px-3 py-2 bg-background"
                  value={formData.sourceLang}
                  onChange={(e) => setFormData({ ...formData, sourceLang: e.target.value })}
                >
                  <option value="en">{tCreate('english')}</option>
                  <option value="zh">{tCreate('chinese')}</option>
                  <option value="ja">{tCreate('japanese')}</option>
                  <option value="ko">{tCreate('korean')}</option>
                  <option value="fr">{tCreate('french')}</option>
                  <option value="de">{tCreate('german')}</option>
                  <option value="es">{tCreate('spanish')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{tCreate('targetLanguage')}</label>
                <select
                  className="w-full border border-input rounded px-3 py-2 bg-background"
                  value={formData.targetLang}
                  onChange={(e) => setFormData({ ...formData, targetLang: e.target.value })}
                >
                  <option value="zh">{tCreate('chinese')}</option>
                  <option value="en">{tCreate('english')}</option>
                  <option value="ja">{tCreate('japanese')}</option>
                  <option value="ko">{tCreate('korean')}</option>
                  <option value="fr">{tCreate('french')}</option>
                  <option value="de">{tCreate('german')}</option>
                  <option value="es">{tCreate('spanish')}</option>
                </select>
              </div>
            </div>
          )}

          {/* 解析服务提供商（仅解析任务） */}
          {formData.taskType === 'parsing' && (
            <div>
              <label className="block text-sm font-medium mb-1">{tCreate('parsingProvider')}</label>
              <select
                className="w-full border border-input rounded px-3 py-2 bg-background"
                value={formData.providerConfigId}
                onChange={(e) => {
                  const provider = providers.find((p) => p.id === e.target.value);
                  setFormData({
                    ...formData,
                    providerConfigId: e.target.value,
                    engine: provider?.providerType || 'mineru',
                  });
                }}
                required
              >
                <option value="">{tCreate('selectProvider')}</option>
                {providers
                  .filter((provider) => provider.providerType === 'mineru')
                  .map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name} ({provider.providerType})
                      {provider.isDefault && ` ${tCreate('default')}`}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* 翻译服务提供商（翻译任务或解析后翻译） */}
          {(formData.taskType === 'translation' || (formData.taskType === 'parsing' && translateAfterParsing)) && (
            <div>
              <label className="block text-sm font-medium mb-1">{tCreate('translationProvider')}</label>
              <select
                className="w-full border border-input rounded px-3 py-2 bg-background"
                value={formData.taskType === 'translation' ? formData.providerConfigId : formData.translationProviderConfigId}
                onChange={(e) => {
                  const provider = providers.find((p) => p.id === e.target.value);
                  if (formData.taskType === 'translation') {
                    setFormData({
                      ...formData,
                      providerConfigId: e.target.value,
                      engine: provider?.providerType || 'openai',
                    });
                  } else {
                    // 解析后翻译，保存到单独的字段
                    setFormData({
                      ...formData,
                      translationProviderConfigId: e.target.value,
                    });
                  }
                }}
                required
              >
                <option value="">{tCreate('selectProvider')}</option>
                {providers
                  .filter((provider) => provider.providerType !== 'mineru')
                  .map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name} ({provider.providerType})
                      {provider.isDefault && ` ${tCreate('default')}`}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">{tCreate('priority')}</label>
            <select
              className="w-full border border-input rounded px-3 py-2 bg-background"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'normal' | 'high' })}
            >
              <option value="normal">{tCreate('normal')}</option>
              <option value="high">{tCreate('high')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{tCreate('notes')} ({tCreate('optional')})</label>
            <textarea
              className="w-full border border-input rounded px-3 py-2 bg-background"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              maxLength={500}
            />
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>{tCreate('cancel')}</Button>
            <Button type="submit" disabled={batchMutation.isPending || entries.length === 0}>
              {batchMutation.isPending ? t('creating') : t('createTasks')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
