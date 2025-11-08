'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksAPI } from '@/lib/api/tasks';
import { usersAPI } from '@/lib/api/users';
import { Button } from '@/components/ui/button';
import { Task } from '@/lib/types/task';
import { ProviderConfig } from '@/lib/types/provider';

export default function TasksPage() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksAPI.list(),
  });

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

  if (isLoading) return <div>Loading...</div>;

  const tasks = tasksData?.tasks || [];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Tasks</h1>
        <Button onClick={() => setShowDialog(true)}>Create Task</Button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Languages</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Engine</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pages</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tasks.map((task: Task) => (
              <tr key={task.id}>
                <td className="px-6 py-4">
                  <div className="font-medium">{task.documentName}</div>
                  <div className="text-sm text-gray-500">{new Date(task.createdAt).toLocaleString()}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {task.sourceLang} → {task.targetLang}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
                    {task.engine}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded ${
                    task.status === 'completed' ? 'bg-green-100 text-green-800' :
                    task.status === 'failed' ? 'bg-red-100 text-red-800' :
                    task.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                    task.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {task.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{task.progress}%</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{task.pageCount}</td>
                <td className="px-6 py-4 whitespace-nowrap space-x-2">
                  {task.status === 'completed' && task.outputUrl && (
                    <Button variant="outline" size="sm" onClick={() => window.open(task.outputUrl, '_blank')}>
                      Download
                    </Button>
                  )}
                  {task.status === 'processing' && (
                    <Button variant="outline" size="sm" onClick={() => cancelMutation.mutate(task.id)}>
                      Cancel
                    </Button>
                  )}
                  {task.status === 'failed' && (
                    <Button variant="outline" size="sm" onClick={() => retryMutation.mutate(task.id)}>
                      Retry
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showDialog && <CreateTaskDialog onClose={() => setShowDialog(false)} />}
    </div>
  );
}

function CreateTaskDialog({ onClose }: { onClose: () => void }) {
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

  const { data: providers = [] } = useQuery({
    queryKey: ['users', 'providers'],
    queryFn: usersAPI.getProviders,
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center overflow-y-auto">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl my-8">
        <h2 className="text-xl font-bold mb-4">Create Translation Task</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">PDF File</label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Document Name</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={formData.documentName}
              onChange={(e) => setFormData({ ...formData, documentName: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Source Language</label>
              <select
                className="w-full border rounded px-3 py-2"
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
                className="w-full border rounded px-3 py-2"
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
              className="w-full border rounded px-3 py-2"
              value={formData.providerConfigId}
              onChange={(e) => {
                const provider = (providers as ProviderConfig[]).find((p) => p.id === e.target.value);
                setFormData({
                  ...formData,
                  providerConfigId: e.target.value,
                  engine: provider?.providerType || 'openai',
                });
              }}
              required
            >
              <option value="">Select provider...</option>
              {(providers as ProviderConfig[]).map((provider) => (
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
              className="w-full border rounded px-3 py-2"
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
              className="w-full border rounded px-3 py-2"
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
