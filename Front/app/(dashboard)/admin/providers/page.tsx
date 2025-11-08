'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminProvidersAPI } from '@/lib/api/admin-providers';
import { Button } from '@/components/ui/button';
import { ProviderConfig, CreateProviderRequest } from '@/lib/types/provider';

const PROVIDER_TYPES = [
  'google', 'deepl', 'openai', 'azure_openai', 'ollama', 'gemini',
  'deepseek', 'zhipu', 'siliconflow', 'tencent', 'grok', 'groq'
];

export default function AdminProvidersPage() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editProvider, setEditProvider] = useState<ProviderConfig | null>(null);

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['admin', 'providers'],
    queryFn: adminProvidersAPI.list,
  });

  const deleteMutation = useMutation({
    mutationFn: adminProvidersAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
    },
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Provider Configuration</h1>
        <Button onClick={() => setShowDialog(true)}>Create Provider</Button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Default</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {providers.map((provider: ProviderConfig) => (
              <tr key={provider.id}>
                <td className="px-6 py-4 whitespace-nowrap font-medium">{provider.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
                    {provider.providerType}
                  </span>
                </td>
                <td className="px-6 py-4">{provider.description || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded ${provider.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {provider.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {provider.isDefault && <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">Default</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setEditProvider(provider)}>Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(provider.id)}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showDialog && <ProviderDialog onClose={() => setShowDialog(false)} />}
      {editProvider && <EditProviderDialog provider={editProvider} onClose={() => setEditProvider(null)} />}
    </div>
  );
}

function ProviderDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    providerType: 'openai',
    description: '',
    isActive: true,
    isDefault: false,
    settings: {} as Record<string, any>,
  });

  const createMutation = useMutation({
    mutationFn: adminProvidersAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const updateSettings = (key: string, value: string) => {
    setFormData({ ...formData, settings: { ...formData.settings, [key]: value } });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center overflow-y-auto">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl my-8">
        <h2 className="text-xl font-bold mb-4">Create Provider</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Provider Type</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={formData.providerType}
              onChange={(e) => setFormData({ ...formData, providerType: e.target.value, settings: {} })}
            >
              {PROVIDER_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              className="w-full border rounded px-3 py-2"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium mb-2">Settings</h3>
            {['openai', 'deepl', 'gemini', 'deepseek', 'zhipu', 'grok', 'groq'].includes(formData.providerType) && (
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">API Key</label>
                <input
                  type="password"
                  className="w-full border rounded px-3 py-2"
                  value={formData.settings.api_key || ''}
                  onChange={(e) => updateSettings('api_key', e.target.value)}
                />
              </div>
            )}
            {formData.providerType === 'azure_openai' && (
              <>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">API Key</label>
                  <input
                    type="password"
                    className="w-full border rounded px-3 py-2"
                    value={formData.settings.api_key || ''}
                    onChange={(e) => updateSettings('api_key', e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Endpoint</label>
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2"
                    value={formData.settings.endpoint || ''}
                    onChange={(e) => updateSettings('endpoint', e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Deployment Name</label>
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2"
                    value={formData.settings.deployment_name || ''}
                    onChange={(e) => updateSettings('deployment_name', e.target.value)}
                  />
                </div>
              </>
            )}
            {formData.providerType === 'ollama' && (
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Endpoint</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={formData.settings.endpoint || ''}
                  onChange={(e) => updateSettings('endpoint', e.target.value)}
                  placeholder="http://localhost:11434"
                />
              </div>
            )}
            {formData.providerType === 'tencent' && (
              <>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Secret ID</label>
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2"
                    value={formData.settings.secret_id || ''}
                    onChange={(e) => updateSettings('secret_id', e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Secret Key</label>
                  <input
                    type="password"
                    className="w-full border rounded px-3 py-2"
                    value={formData.settings.secret_key || ''}
                    onChange={(e) => updateSettings('secret_key', e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm font-medium">Active</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm font-medium">Set as Default</span>
            </label>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditProviderDialog({ provider, onClose }: { provider: ProviderConfig; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: provider.name,
    description: provider.description,
    isActive: provider.isActive,
    isDefault: provider.isDefault,
    settings: provider.settings,
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => adminProvidersAPI.update(provider.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const updateSettings = (key: string, value: string) => {
    setFormData({ ...formData, settings: { ...formData.settings, [key]: value } });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center overflow-y-auto">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl my-8">
        <h2 className="text-xl font-bold mb-4">Edit Provider</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              className="w-full border rounded px-3 py-2"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium mb-2">Settings</h3>
            {Object.entries(formData.settings).map(([key, value]) => (
              <div key={key} className="mb-3">
                <label className="block text-sm font-medium mb-1">{key}</label>
                <input
                  type={key.includes('key') || key.includes('secret') ? 'password' : 'text'}
                  className="w-full border rounded px-3 py-2"
                  value={value as string}
                  onChange={(e) => updateSettings(key, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm font-medium">Active</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm font-medium">Set as Default</span>
            </label>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Update</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
