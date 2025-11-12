'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState, useEffect, useRef, useMemo } from 'react';
import { getAdminTasks, cancelAdminTask, retryAdminTask, deleteAdminTask } from '@/lib/api/analytics';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Portal } from '@/components/ui/portal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Task } from '@/lib/types/task';
import { toast } from 'sonner';
import { Download, Trash2, FileText } from 'lucide-react';

export default function AdminTasksPage() {
  const queryClient = useQueryClient();
  const t = useTranslations();
  const [filters, setFilters] = useState({
    ownerEmail: '',
    status: '',
    engine: '',
    priority: '',
    dateFrom: '',
    dateTo: '',
  });
  const [page, setPage] = useState(0);
  const limit = 50;

  // State for bulk operations
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // State for action menu
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; id: string } | null>(null);

  // State for dialogs
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tasks', filters, page],
    queryFn: () => getAdminTasks({
      ...filters,
      ownerEmail: filters.ownerEmail || undefined,
      status: filters.status || undefined,
      engine: filters.engine || undefined,
      priority: filters.priority || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      limit,
      offset: page * limit,
    }),
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const getStatusText = (status: string) => {
    return t(`tasks.status.${status}`) || status;
  };

  // Memoize tasks array
  const tasks = useMemo(() => (data?.tasks || []) as Task[], [data?.tasks]);

  // 从实时更新的任务列表中查找当前要显示详情的任务
  const detailTask = useMemo(() =>
    tasks.find(t => t.id === detailTaskId) ?? null,
    [tasks, detailTaskId]
  );

  // 当任务被删除时自动关闭详情弹窗
  useEffect(() => {
    if (detailTaskId && !detailTask) {
      setDetailTaskId(null);
    }
  }, [detailTaskId, detailTask]);

  // Sync selected tasks with current page
  useEffect(() => {
    setSelectedTaskIds((prev) => {
      const validIds = new Set(tasks.map((task) => task.id));
      const next = new Set(Array.from(prev).filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [tasks]);

  // Selection state
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

  // Download functionality
  const downloadFile = async (url: string, filename: string) => {
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
      toast.error(t('tasks.downloadError'));
    }
  };

  const handleBulkDownload = async () => {
    if (!hasSelection) return;

    const selectedTasks = tasks.filter(task => selectedTaskIds.has(task.id));
    const completedTasks = selectedTasks.filter(task => task.status === 'completed');

    if (completedTasks.length === 0) {
      toast.error(t('tasks.noCompletedTasks'));
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
      toast.error(t('tasks.noDownloadableFiles'));
      return;
    }

    toast.success(t('tasks.downloadSuccess', { count: downloads.length }));

    for (let i = 0; i < downloads.length; i++) {
      await new Promise(resolve => setTimeout(resolve, i * 200));
      await downloadFile(downloads[i].url, downloads[i].filename);
    }
  };

  // Mutations
  const cancelMutation = useMutation({
    mutationFn: cancelAdminTask,
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ['admin-tasks'] });
      const previousData = queryClient.getQueryData(['admin-tasks', filters, page]);

      queryClient.setQueryData(['admin-tasks', filters, page], (old: { tasks: Task[]; total: number; limit: number; offset: number } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks.map((task: Task) =>
            task.id === taskId ? { ...task, status: 'cancelled' as const } : task
          ),
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      toast.success(t('tasks.cancelSuccess'));
    },
    onError: (_err, _taskId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['admin-tasks', filters, page], context.previousData);
      }
      toast.error(t('tasks.cancelError'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tasks'] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: retryAdminTask,
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ['admin-tasks'] });
      const previousData = queryClient.getQueryData(['admin-tasks', filters, page]);

      queryClient.setQueryData(['admin-tasks', filters, page], (old: { tasks: Task[]; total: number; limit: number; offset: number } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks.map((task: Task) =>
            task.id === taskId ? { ...task, status: 'pending' as const, progress: 0 } : task
          ),
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      toast.success(t('tasks.retrySuccess'));
    },
    onError: (_err, _taskId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['admin-tasks', filters, page], context.previousData);
      }
      toast.error(t('tasks.retryError'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tasks'] });
    },
  });

  const confirmBulkDelete = async () => {
    if (!hasSelection) return;
    const count = selectedTaskIds.size;

    await queryClient.cancelQueries({ queryKey: ['admin-tasks'] });
    const previousData = queryClient.getQueryData(['admin-tasks', filters, page]);

    queryClient.setQueryData(['admin-tasks', filters, page], (old: { tasks: Task[]; total: number; limit: number; offset: number } | undefined) => {
      if (!old) return old;
      return {
        ...old,
        tasks: old.tasks.filter((task: Task) => !selectedTaskIds.has(task.id)),
      };
    });

    setSelectedTaskIds(new Set());
    setIsDeleting(true);
    setShowDeleteConfirm(false);

    try {
      await Promise.all(Array.from(selectedTaskIds).map((id) => deleteAdminTask(id)));
      toast.success(count === 1 ? t('tasks.deleteSuccess') : t('tasks.bulkDeleteSuccess', { count }));
    } catch (error) {
      console.error('Failed to delete tasks', error);
      if (previousData) {
        queryClient.setQueryData(['admin-tasks', filters, page], previousData);
      }
      toast.error(t('tasks.deleteError'));
    } finally {
      setIsDeleting(false);
      queryClient.invalidateQueries({ queryKey: ['admin-tasks'] });
    }
  };

  const confirmSingleDelete = async () => {
    if (!taskToDelete) return;

    await queryClient.cancelQueries({ queryKey: ['admin-tasks'] });
    const previousData = queryClient.getQueryData(['admin-tasks', filters, page]);

    queryClient.setQueryData(['admin-tasks', filters, page], (old: { tasks: Task[]; total: number; limit: number; offset: number } | undefined) => {
      if (!old) return old;
      return {
        ...old,
        tasks: old.tasks.filter((task: Task) => task.id !== taskToDelete),
      };
    });

    setIsDeleting(true);
    setTaskToDelete(null);

    try {
      await deleteAdminTask(taskToDelete);
      toast.success(t('tasks.deleteSuccess'));
    } catch (error) {
      console.error('Failed to delete task', error);
      if (previousData) {
        queryClient.setQueryData(['admin-tasks', filters, page], previousData);
      }
      toast.error(t('tasks.deleteError'));
    } finally {
      setIsDeleting(false);
      queryClient.invalidateQueries({ queryKey: ['admin-tasks'] });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">{t('admin.tasks.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('admin.tasks.description')}</p>
        </div>
        <SkeletonTable rows={10} columns={9} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">{t('admin.tasks.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('admin.tasks.description')}</p>
      </div>

      {/* Filters */}
      <div className="p-6 rounded-lg bg-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium">{t('admin.tasks.filters')}</h3>
          <button
            onClick={() => {
              setFilters({
                ownerEmail: '',
                status: '',
                engine: '',
                priority: '',
                dateFrom: '',
                dateTo: '',
              });
              setPage(0);
            }}
            className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors"
          >
            {t('admin.tasks.clearFilters')}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">{t('admin.tasks.filterByEmail')}</label>
            <input
              type="text"
              placeholder={t('admin.tasks.filterByEmail')}
              value={filters.ownerEmail}
              onChange={(e) => handleFilterChange('ownerEmail', e.target.value)}
              className="w-full px-3 py-2 border border-border bg-background rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">{t('admin.tasks.status')}</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-border bg-background rounded-md"
            >
              <option value="">{t('admin.tasks.allStatuses')}</option>
              <option value="pending">{t('tasks.status.pending')}</option>
              <option value="processing">{t('tasks.status.processing')}</option>
              <option value="completed">{t('tasks.status.completed')}</option>
              <option value="failed">{t('tasks.status.failed')}</option>
              <option value="cancelled">{t('tasks.status.cancelled')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">{t('admin.tasks.priority')}</label>
            <select
              value={filters.priority}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              className="w-full px-3 py-2 border border-border bg-background rounded-md"
            >
              <option value="">{t('admin.tasks.allPriorities')}</option>
              <option value="normal">{t('tasks.priority.normal')}</option>
              <option value="high">{t('tasks.priority.high')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">{t('admin.tasks.dateFrom')}</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="w-full px-3 py-2 border border-border bg-background rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">{t('admin.tasks.dateTo')}</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="w-full px-3 py-2 border border-border bg-background rounded-md"
            />
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {hasSelection && (
        <div className="flex items-center justify-between gap-3 p-4 bg-card border border-border rounded-lg">
          <span className="text-sm text-muted-foreground">{selectedTaskIds.size} {t('tasks.selected')}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDownload}
              className="h-9 gap-1.5"
            >
              <Download className="h-4 w-4" />
              {t('tasks.bulkDownload')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="h-9 gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? t('tasks.deleting') : t('tasks.delete')}
            </Button>
          </div>
        </div>
      )}

      {/* Tasks Table */}
      {tasks.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t('admin.tasks.noTasks')}
          description={t('admin.tasks.noTasksDescription')}
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
                        {task.ownerEmail}
                      </p>
                      {task.sourceLang && task.targetLang && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {task.sourceLang} → {task.targetLang}
                        </p>
                      )}
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
                    <span>{task.engine}</span>
                    <span>{task.pageCount} {t('tasks.pages')}</span>
                  </div>
                  <span>{new Date(task.createdAt).toLocaleDateString()}</span>
                </div>

                <div className="flex gap-2 pt-2 border-t border-border">
                  <button
                    onClick={() => setDetailTaskId(task.id)}
                    className="flex-1 px-3 py-1.5 text-xs bg-accent hover:bg-accent/80 rounded-md transition-colors"
                  >
                    {t('tasks.view')}
                  </button>
                  {task.status === 'processing' && (
                    <button
                      onClick={() => cancelMutation.mutate(task.id)}
                      className="flex-1 px-3 py-1.5 text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-md transition-colors"
                      disabled={cancelMutation.isPending}
                    >
                      {t('tasks.cancel')}
                    </button>
                  )}
                  {task.status === 'failed' && (
                    <button
                      onClick={() => retryMutation.mutate(task.id)}
                      className="flex-1 px-3 py-1.5 text-xs bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
                      disabled={retryMutation.isPending}
                    >
                      {t('tasks.retry')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block rounded-lg bg-card overflow-hidden border border-border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
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
                <th className="px-4 py-2.5 text-left font-medium min-w-[180px]">{t('admin.tasks.documentName')}</th>
                <th className="px-4 py-2.5 text-left font-medium min-w-[160px]">{t('admin.tasks.owner')}</th>
                <th className="px-4 py-2.5 text-left font-medium">{t('admin.tasks.status')}</th>
                <th className="px-4 py-2.5 text-left font-medium">{t('admin.tasks.priority')}</th>
                <th className="px-4 py-2.5 text-left font-medium w-[140px]">{t('admin.tasks.progress')}</th>
                <th className="px-4 py-2.5 text-left font-medium">{t('admin.tasks.pages')}</th>
                <th className="px-4 py-2.5 text-left font-medium">{t('admin.tasks.createdAt')}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t('tasks.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tasks.map((task: Task) => (
                <tr key={task.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-primary"
                      onChange={() => toggleTaskSelection(task.id)}
                      checked={selectedTaskIds.has(task.id)}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-sm font-medium">{task.documentName}</td>
                  <td className="px-4 py-2.5">
                    <div className="text-sm">
                      <div className="font-medium">{task.ownerEmail}</div>
                      <div className="text-xs text-muted-foreground">{task.ownerId}</div>
                    </div>
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
                  <td className="px-4 py-2.5 text-sm">{t(`tasks.priority.${task.priority}`)}</td>
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
                    {new Date(task.createdAt).toLocaleString()}
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
                              setDetailTaskId(task.id);
                              setActiveMenu(null);
                              setMenuPos(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                          >
                            {t('tasks.detail')}
                          </button>
                          {task.inputUrl && (
                            <button
                              onClick={() => {
                                downloadFile(task.inputUrl!, `${task.documentName}_original.pdf`);
                                setActiveMenu(null);
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                            >
                              {t('tasks.downloadOriginal')}
                            </button>
                          )}
                          {task.status === 'completed' && task.dualOutputUrl && (
                            <button
                              onClick={() => {
                                downloadFile(task.dualOutputUrl!, `${task.documentName}_dual.pdf`);
                                setActiveMenu(null);
                                setMenuPos(null);
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                            >
                              {t('tasks.downloadDual')}
                            </button>
                          )}
                          {task.status === 'completed' && task.monoOutputUrl && (
                            <button
                              onClick={() => {
                                downloadFile(task.monoOutputUrl!, `${task.documentName}_mono.pdf`);
                                setActiveMenu(null);
                                setMenuPos(null);
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                            >
                              {t('tasks.downloadMono')}
                            </button>
                          )}
                          {task.status === 'completed' && !task.dualOutputUrl && !task.monoOutputUrl && task.outputUrl && (
                            <button
                              onClick={() => {
                                downloadFile(task.outputUrl!, `${task.documentName}.pdf`);
                                setActiveMenu(null);
                                setMenuPos(null);
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                            >
                              {t('tasks.download')}
                            </button>
                          )}
                          {task.status === 'completed' && task.zipOutputUrl && (
                            <button
                              onClick={() => {
                                downloadFile(task.zipOutputUrl!, `${task.documentName}.zip`);
                                setActiveMenu(null);
                                setMenuPos(null);
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                            >
                              {t('tasks.downloadZip')}
                            </button>
                          )}
                          {task.status === 'completed' && task.markdownOutputUrl && (
                            <button
                              onClick={() => {
                                downloadFile(task.markdownOutputUrl!, `${task.documentName}.md`);
                                setActiveMenu(null);
                                setMenuPos(null);
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                            >
                              {t('tasks.downloadMarkdown')}
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
                              {t('tasks.cancel')}
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
                              {t('tasks.retry')}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setTaskToDelete(task.id);
                              setActiveMenu(null);
                              setMenuPos(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors text-destructive"
                          >
                            {t('tasks.delete')}
                          </button>
                        </div>
                      </Portal>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <div className="text-sm text-muted-foreground">
              {t('admin.tasks.showing', {
                from: page * limit + 1,
                to: Math.min((page + 1) * limit, data.total),
                total: data.total,
              })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 border border-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
              >
                {t('common.previous')}
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * limit >= data.total}
                className="px-3 py-1 border border-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}
          </div>

          {/* Mobile Pagination */}
          {data && data.total > 0 && (
            <div className="md:hidden flex items-center justify-between p-4 bg-card border border-border rounded-lg">
              <div className="text-sm text-muted-foreground">
                {t('admin.tasks.showing', {
                  from: page * limit + 1,
                  to: Math.min((page + 1) * limit, data.total),
                  total: data.total,
                })}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 border border-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted text-sm"
                >
                  {t('common.previous')}
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={(page + 1) * limit >= data.total}
                  className="px-3 py-1 border border-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted text-sm"
                >
                  {t('common.next')}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Task Detail Dialog */}
      {detailTask && <TaskDetailDialog task={detailTask} onClose={() => setDetailTaskId(null)} downloadFile={downloadFile} />}

      {/* Confirmation Dialogs */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title={t('tasks.confirmDelete.title')}
          description={t('tasks.confirmDelete.description', { count: selectedTaskIds.size })}
          confirmLabel={t('tasks.confirmDelete.confirm')}
          cancelLabel={t('tasks.confirmDelete.cancel')}
          variant="destructive"
          onConfirm={confirmBulkDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {taskToDelete && (
        <ConfirmDialog
          title={t('tasks.confirmDelete.title')}
          description={t('tasks.confirmDelete.description', { count: 1 })}
          confirmLabel={t('tasks.confirmDelete.confirm')}
          cancelLabel={t('tasks.confirmDelete.cancel')}
          variant="destructive"
          onConfirm={confirmSingleDelete}
          onCancel={() => setTaskToDelete(null)}
        />
      )}
    </div>
  );
}

function TaskDetailDialog({ task, onClose, downloadFile }: { task: Task; onClose: () => void; downloadFile: (url: string, filename: string) => Promise<void> }) {
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
              <label className="text-sm font-medium text-muted-foreground">{t('statusLabel')}</label>
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
              <label className="text-sm font-medium text-muted-foreground">Owner</label>
              <p className="text-sm mt-1">{task.ownerEmail}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{task.ownerId}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('engine')}</label>
              <p className="text-sm mt-1">{task.engine}</p>
            </div>
          </div>
          {task.sourceLang && task.targetLang && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('languages')}</label>
                <p className="text-sm mt-1">{task.sourceLang} → {task.targetLang}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Priority</label>
                <p className="text-sm mt-1">{task.priority}</p>
              </div>
            </div>
          )}
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
              <Button variant="outline" size="sm" onClick={() => downloadFile(task.inputUrl!, `${task.documentName}_original.pdf`)}>
                {t('downloadOriginal')}
              </Button>
            )}
            {task.status === 'completed' && task.dualOutputUrl && (
              <Button variant="outline" size="sm" onClick={() => downloadFile(task.dualOutputUrl!, `${task.documentName}_dual.pdf`)}>
                {t('downloadDual')}
              </Button>
            )}
            {task.status === 'completed' && task.monoOutputUrl && (
              <Button variant="outline" size="sm" onClick={() => downloadFile(task.monoOutputUrl!, `${task.documentName}_mono.pdf`)}>
                {t('downloadMono')}
              </Button>
            )}
            {task.status === 'completed' && !task.dualOutputUrl && !task.monoOutputUrl && task.outputUrl && (
              <Button variant="outline" size="sm" onClick={() => downloadFile(task.outputUrl!, `${task.documentName}.pdf`)}>
                {t('download')}
              </Button>
            )}
            {task.status === 'completed' && task.zipOutputUrl && (
              <Button variant="outline" size="sm" onClick={() => downloadFile(task.zipOutputUrl!, `${task.documentName}.zip`)}>
                {t('downloadZip')}
              </Button>
            )}
            {task.status === 'completed' && task.markdownOutputUrl && (
              <Button variant="outline" size="sm" onClick={() => downloadFile(task.markdownOutputUrl!, `${task.documentName}.md`)}>
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
