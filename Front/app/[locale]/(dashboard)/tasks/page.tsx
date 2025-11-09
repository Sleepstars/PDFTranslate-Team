'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksAPI } from '@/lib/api/tasks';
import { usersAPI } from '@/lib/api/users';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Task } from '@/lib/types/task';
import { ProviderConfig } from '@/lib/types/provider';
import { useTaskUpdates } from '@/lib/hooks/use-task-updates';
import { useTranslations } from 'next-intl';

export default function TasksPage() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const isRealtimeConnected = useTaskUpdates();
  const refetchOnWindowFocus = !isRealtimeConnected;
  const refetchInterval = isRealtimeConnected ? false : 4000;
  const selectAllRef = useRef<HTMLInputElement>(null);
  const t = useTranslations('tasks');
  const _tCommon = useTranslations('common');

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: tasksAPI.retry,
    onSuccess: () => {
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

  const handleBulkDelete = async () => {
    if (!hasSelection) return;
    const count = selectedTaskIds.size;
    const confirmMessage = count === 1
      ? 'Delete the selected task? This removes associated files permanently.'
      : `Delete ${count} selected tasks? This removes associated files permanently.`;
    if (!window.confirm(confirmMessage)) return;
    setIsDeleting(true);
    try {
      await Promise.all(Array.from(selectedTaskIds).map((id) => tasksAPI.delete(id)));
      setSelectedTaskIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch (error) {
      console.error('Failed to delete tasks', error);
      window.alert('Some tasks could not be deleted. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-64">{_tCommon('loading')}</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold mb-1">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">
          Realtime status: {isRealtimeConnected ? <span className="text-green-600 dark:text-green-400">{t('realtime.connected')}</span> : <span className="text-yellow-600 dark:text-yellow-400">{t('realtime.reconnecting')}</span>}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => setShowDialog(true)} size="sm" className="h-9">
          + {t('create')}
        </Button>
        <Button variant="outline" onClick={() => setShowBatchDialog(true)} size="sm" className="h-9">
          {t('batch')}
        </Button>
      </div>

      {hasSelection && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-4 py-3">
          <div className="text-sm text-muted-foreground">{selectedTaskIds.size} {t('selected')}</div>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={isDeleting}>
            {isDeleting ? t('deleting') : t('delete')}
          </Button>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg overflow-visible">
        <table className="w-full">
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
              <th className="px-4 py-2.5 text-left font-medium">{t('status')}</th>
              <th className="px-4 py-2.5 text-left font-medium w-[120px]">{t('progress')}</th>
              <th className="px-4 py-2.5 text-left font-medium">{t('pages')}</th>
              <th className="px-4 py-2.5 text-left font-medium">{t('created')}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tasks.map((task: Task) => (
              <tr key={task.id} className="hover:bg-muted/30 transition-colors">
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
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground min-w-[2.5rem]">{task.progress}%</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-sm">{task.pageCount}</td>
                <td className="px-4 py-2.5 text-sm text-muted-foreground whitespace-nowrap">
                  {new Date(task.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="relative inline-block">
                    <button
                      onClick={() => setActiveMenu(activeMenu === task.id ? null : task.id)}
                      className="p-1 hover:bg-muted rounded transition-colors"
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
                        <circle cx="8" cy="2" r="1.5"/>
                        <circle cx="8" cy="8" r="1.5"/>
                        <circle cx="8" cy="14" r="1.5"/>
                      </svg>
                    </button>
                    {activeMenu === task.id && (
                      <div className="absolute right-0 mt-1 w-40 bg-popover border border-border rounded-md shadow-lg z-10">
                        <button
                          onClick={() => {
                            setDetailTask(task);
                            setActiveMenu(null);
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
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                          >
                            {t('download')}
                          </button>
                        )}
                        {task.status === 'processing' && (
                          <button
                            onClick={() => {
                              cancelMutation.mutate(task.id);
                              setActiveMenu(null);
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
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                          >
                            {t('retry')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showDialog && <CreateTaskDialog providers={providers} onClose={() => setShowDialog(false)} />}
      {showBatchDialog && <BatchUploadDialog providers={providers} onClose={() => setShowBatchDialog(false)} />}
      {detailTask && <TaskDetailDialog task={detailTask} providerName={providerMap.get(detailTask.providerConfigId || '')?.name} onClose={() => setDetailTask(null)} />}
    </div>
  );
}

function TaskDetailDialog({ task, providerName, onClose }: { task: Task; providerName?: string; onClose: () => void }) {
  const t = useTranslations('tasks');
  const _tCommon = useTranslations('common');
  
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
  const [formData, setFormData] = useState({
    documentName: '',
    sourceLang: 'en',
    targetLang: 'zh',
    engine: 'openai',
    priority: 'normal' as 'normal' | 'high',
    notes: '',
    providerConfigId: '',
  });
  const t = useTranslations('tasks.createDialog');
  const _tCommon = useTranslations('common');

  const createMutation = useMutation({
    mutationFn: tasksAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'quota'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    createMutation.mutate({
      file,
      ...formData,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!formData.documentName) {
        setFormData({ ...formData, documentName: selectedFile.name.replace('.pdf', '') });
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center overflow-y-auto z-50">
      <div className="bg-card rounded-lg p-6 w-full max-w-2xl my-8 border border-border">
        <h2 className="text-xl font-bold mb-4">{t('title')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('pdfFile')}</label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="w-full border border-input rounded px-3 py-2 bg-background"
              required
            />
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

          <div>
            <label className="block text-sm font-medium mb-1">{t('translationProvider')}</label>
            <select
              className="w-full border border-input rounded px-3 py-2 bg-background"
              value={formData.providerConfigId}
              onChange={(e) => {
                const provider = providers.find((p) => p.id === e.target.value);
                setFormData({
                  ...formData,
                  providerConfigId: e.target.value,
                  engine: provider?.providerType || 'openai',
                });
              }}
              required
            >
              <option value="">{t('selectProvider')}</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} ({provider.providerType})
                  {provider.isDefault && ` ${t('default')}`}
                </option>
              ))}
            </select>
          </div>

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
  const [formData, setFormData] = useState({
    sourceLang: 'en',
    targetLang: 'zh',
    engine: 'openai',
    priority: 'normal' as 'normal' | 'high',
    notes: '',
    providerConfigId: '',
  });
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations('tasks.batchDialog');
  const tCreate = useTranslations('tasks.createDialog');

  const batchMutation = useMutation({
    mutationFn: tasksAPI.createBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'quota'] });
      onClose();
    },
  });

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    if (!files.length) {
      return;
    }
    setEntries((prev) => [
      ...prev,
      ...files.map((file, index) => ({
        id: `${file.name}-${Date.now()}-${index}`,
        file,
        documentName: file.name.replace(/\.pdf$/i, ''),
      })),
    ]);
    e.target.value = '';
  };

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
    batchMutation.mutate({
      files: entries.map((entry) => entry.file),
      documentNames: entries.map((entry) => entry.documentName.trim()),
      sourceLang: formData.sourceLang,
      targetLang: formData.targetLang,
      engine: formData.engine,
      priority: formData.priority,
      notes: formData.notes || undefined,
      providerConfigId: formData.providerConfigId || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center overflow-y-auto z-50">
      <div className="bg-card rounded-lg p-6 w-full max-w-3xl my-8 border border-border">
        <h2 className="text-xl font-bold mb-4">{t('title')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('selectFiles')}</label>
            <input
              type="file"
              multiple
              accept=".pdf"
              onChange={handleFilesSelected}
              className="w-full border border-input rounded px-3 py-2 bg-background"
            />
            <p className="text-xs text-muted-foreground mt-1">{t('selectFilesDescription')}</p>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{tCreate('translationProvider')}</label>
              <select
                className="w-full border border-input rounded px-3 py-2 bg-background"
                value={formData.providerConfigId}
                onChange={(e) => {
                  const provider = providers.find((p) => p.id === e.target.value);
                  setFormData({
                    ...formData,
                    providerConfigId: e.target.value,
                    engine: provider?.providerType || formData.engine,
                  });
                }}
                required
              >
                <option value="">{tCreate('selectProvider')}</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name} ({provider.providerType}){provider.isDefault ? ` ${tCreate('default')}` : ''}
                  </option>
                ))}
              </select>
            </div>
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
