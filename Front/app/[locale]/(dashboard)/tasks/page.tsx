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

export default function TasksPage() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const isRealtimeConnected = useTaskUpdates();
  const refetchOnWindowFocus = !isRealtimeConnected;
  const refetchInterval = isRealtimeConnected ? false : 4000;
  const selectAllRef = useRef<HTMLInputElement>(null);

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
      const next = new Set([...prev].filter((id) => validIds.has(id)));
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

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Realtime status: {isRealtimeConnected ? <span className="text-green-600 dark:text-green-400">connected</span> : <span className="text-yellow-600 dark:text-yellow-400">reconnecting...</span>}
          </p>
        </div>
        <div className="space-x-2">
          <Button variant="outline" onClick={() => setShowBatchDialog(true)}>Batch Upload</Button>
          <Button onClick={() => setShowDialog(true)}>Create Task</Button>
        </div>
      </div>

      {hasSelection && (
        <div className="flex items-center justify-between mb-4 rounded-lg border border-border bg-muted px-4 py-3">
          <div className="text-sm text-muted-foreground">{selectedTaskIds.size} selected</div>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={isDeleting}>
            {isDeleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      )}

      <div className="bg-card rounded-lg shadow border border-border overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase w-12">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  className="h-4 w-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-primary"
                  onChange={handleSelectAllToggle}
                  checked={tasks.length > 0 && allSelected}
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Document</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Languages</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Engine</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Progress</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Pages</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Created At</th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {tasks.map((task: Task) => (
              <tr key={task.id}>
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-primary"
                    onChange={() => toggleTaskSelection(task.id)}
                    checked={selectedTaskIds.has(task.id)}
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium">{task.documentName}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {task.sourceLang} → {task.targetLang}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant="info">{providerMap.get(task.providerConfigId || '')?.name || task.engine}</Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant={
                    task.status === 'completed' ? 'success' :
                    task.status === 'failed' ? 'error' :
                    task.status === 'processing' ? 'info' :
                    task.status === 'cancelled' ? 'secondary' :
                    'warning'
                  }>
                    {task.status}
                  </Badge>
                </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="max-w-[140px]">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{task.progress}%</span>
                  {task.progressMessage &&
                    task.status !== 'completed' &&
                    task.status !== 'canceled' &&
                    task.status !== 'cancelled' && (
                    <div className="text-xs text-muted-foreground mt-1">
                      <span
                        className="block w-full truncate"
                        title={task.progressMessage}
                      >
                        {task.progressMessage}
                      </span>
                    </div>
                  )}
                </div>
              </td>
                <td className="px-6 py-4 whitespace-nowrap">{task.pageCount}</td>
                <td className="px-6 py-4 whitespace-nowrap space-x-2">
                  {task.status === 'completed' && (task.dualOutputUrl || task.monoOutputUrl || task.outputUrl) && (
                    <div className="flex flex-wrap gap-2">
                      {task.dualOutputUrl && (
                        <Button variant="outline" size="sm" onClick={() => window.open(task.dualOutputUrl!, '_blank')}>
                          Dual PDF
                        </Button>
                      )}
                      {task.monoOutputUrl && (
                        <Button variant="outline" size="sm" onClick={() => window.open(task.monoOutputUrl!, '_blank')}>
                          Mono PDF
                        </Button>
                      )}
                      {!task.dualOutputUrl && !task.monoOutputUrl && task.outputUrl && (
                        <Button variant="outline" size="sm" onClick={() => window.open(task.outputUrl!, '_blank')}>
                          Download
                        </Button>
                      )}
                    </div>
                  )}
                  {task.status === 'processing' && (
                    <Button variant="outline" size="sm" onClick={() => cancelMutation.mutate(task.id)}>
                      Cancel
                    </Button>
                  )}
                  {(task.status === 'failed' ||
                    task.status === 'canceled' ||
                    task.status === 'cancelled') && (
                    <Button variant="outline" size="sm" onClick={() => retryMutation.mutate(task.id)}>
                      Retry
                    </Button>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  {new Date(task.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showDialog && <CreateTaskDialog providers={providers} onClose={() => setShowDialog(false)} />}
      {showBatchDialog && <BatchUploadDialog providers={providers} onClose={() => setShowBatchDialog(false)} />}
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
        <h2 className="text-xl font-bold mb-4">Create Translation Task</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">PDF File</label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="w-full border border-input rounded px-3 py-2 bg-background"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Document Name</label>
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
              <label className="block text-sm font-medium mb-1">Source Language</label>
              <select
                className="w-full border border-input rounded px-3 py-2 bg-background"
                value={formData.sourceLang}
                onChange={(e) => setFormData({ ...formData, sourceLang: e.target.value })}
              >
                <option value="en">English</option>
                <option value="zh">Chinese</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="es">Spanish</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Target Language</label>
              <select
                className="w-full border border-input rounded px-3 py-2 bg-background"
                value={formData.targetLang}
                onChange={(e) => setFormData({ ...formData, targetLang: e.target.value })}
              >
                <option value="zh">Chinese</option>
                <option value="en">English</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="es">Spanish</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Translation Provider</label>
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
              <option value="">Select provider...</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} ({provider.providerType})
                  {provider.isDefault && ' - Default'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <select
              className="w-full border border-input rounded px-3 py-2 bg-background"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'normal' | 'high' })}
            >
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes (Optional)</label>
            <textarea
              className="w-full border border-input rounded px-3 py-2 bg-background"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Task'}
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
        <h2 className="text-xl font-bold mb-4">Batch Upload PDFs</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Select PDF Files</label>
            <input
              type="file"
              multiple
              accept=".pdf"
              onChange={handleFilesSelected}
              className="w-full border border-input rounded px-3 py-2 bg-background"
            />
            <p className="text-xs text-muted-foreground mt-1">You can add multiple files. Each file will become an individual task.</p>
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
                      placeholder="Document name"
                      required
                    />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => removeEntry(entry.id)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Source Language</label>
              <select
                className="w-full border border-input rounded px-3 py-2 bg-background"
                value={formData.sourceLang}
                onChange={(e) => setFormData({ ...formData, sourceLang: e.target.value })}
              >
                <option value="en">English</option>
                <option value="zh">Chinese</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="es">Spanish</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Target Language</label>
              <select
                className="w-full border border-input rounded px-3 py-2 bg-background"
                value={formData.targetLang}
                onChange={(e) => setFormData({ ...formData, targetLang: e.target.value })}
              >
                <option value="zh">Chinese</option>
                <option value="en">English</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="es">Spanish</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Translation Provider</label>
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
                <option value="">Select provider...</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name} ({provider.providerType}){provider.isDefault ? ' - Default' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select
                className="w-full border border-input rounded px-3 py-2 bg-background"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'normal' | 'high' })}
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes (Optional)</label>
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
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={batchMutation.isPending || entries.length === 0}>
              {batchMutation.isPending ? 'Creating...' : 'Create Tasks'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
