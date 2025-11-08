'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminProvidersAPI } from '@/lib/api/admin-providers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProviderConfig, UpdateProviderRequest } from '@/lib/types/provider';

const PROVIDER_TYPES = [
  'google', 'deepl', 'openai', 'azure_openai', 'ollama', 'gemini',
  'deepseek', 'zhipu', 'siliconflow', 'tencent', 'grok', 'groq'
];

const PROVIDERS_WITH_MODEL_FIELD = new Set([
  'openai',
  'deepseek',
  'zhipu',
  'siliconflow',
  'grok',
  'groq',
  'gemini',
  'ollama',
]);

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

      <div className="bg-card rounded-lg shadow border border-border overflow-hidden">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Default</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {providers.map((provider: ProviderConfig) => (
              <tr key={provider.id}>
                <td className="px-6 py-4 whitespace-nowrap font-medium">{provider.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant="info">{provider.providerType}</Badge>
                </td>
                <td className="px-6 py-4">{provider.description || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant={provider.isActive ? 'success' : 'error'}>
                    {provider.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {provider.isDefault && <Badge variant="warning">Default</Badge>}
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
  const [formData, setFormData] = useState<{
    name: string;
    providerType: string;
    description: string;
    isActive: boolean;
    isDefault: boolean;
    settings: Record<string, string | number>;
  }>({
    name: '',
    providerType: 'openai',
    description: '',
    isActive: true,
    isDefault: false,
    settings: {},
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

  const updateSettings = (key: string, value: string | number) => {
    setFormData({ ...formData, settings: { ...formData.settings, [key]: value } });
  };

  const requiresModel = PROVIDERS_WITH_MODEL_FIELD.has(formData.providerType);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center overflow-y-auto">
      <div className="bg-card rounded-lg border border-border p-6 w-full max-w-2xl my-8">
        <h2 className="text-xl font-bold mb-4">Create Provider</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              className="w-full border border-input rounded px-3 py-2 bg-background"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Provider Type</label>
            <select
              className="w-full border border-input rounded px-3 py-2 bg-background"
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
              className="w-full border border-input rounded px-3 py-2 bg-background"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="font-medium mb-2">Settings</h3>
            
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Max Concurrency</label>
              <input
                type="number"
                className="w-full border border-input rounded px-3 py-2 bg-background"
                value={formData.settings.max_concurrency || 4}
                onChange={(e) => updateSettings('max_concurrency', parseInt(e.target.value))}
                min="1"
                max="100"
              />
              <p className="text-xs text-muted-foreground mt-1">Maximum concurrent translation tasks (1-100)</p>
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Requests Per Minute (RPM)</label>
              <input
                type="number"
                className="w-full border border-input rounded px-3 py-2 bg-background"
                value={formData.settings.requests_per_minute || ''}
                onChange={(e) => updateSettings('requests_per_minute', e.target.value ? parseInt(e.target.value) : '')}
                min="1"
                max="10000"
                placeholder="Optional rate limit"
              />
              <p className="text-xs text-muted-foreground mt-1">API rate limit in requests per minute (optional, 1-10000)</p>
            </div>

          {requiresModel && (
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Model</label>
              <input
                type="text"
                className="w-full border border-input rounded px-3 py-2 bg-background"
                value={formData.settings.model || ''}
                onChange={(e) => updateSettings('model', e.target.value)}
                placeholder={
                  formData.providerType === 'openai' ? 'gpt-4' :
                  formData.providerType === 'deepseek' ? 'deepseek-chat' :
                  formData.providerType === 'zhipu' ? 'glm-4' :
                  formData.providerType === 'ollama' ? 'gemma2' :
                  'Model name'
                }
              />
            </div>
          )}

            {formData.providerType === 'openai' && (
              <>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">API Key</label>
                  <input
                    type="password"
                    className="w-full border border-input rounded px-3 py-2 bg-background"
                    value={formData.settings.api_key || ''}
                    onChange={(e) => updateSettings('api_key', e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Base URL (Optional)</label>
                  <input
                    type="text"
                    className="w-full border border-input rounded px-3 py-2 bg-background"
                    value={formData.settings.base_url || ''}
                    onChange={(e) => updateSettings('base_url', e.target.value)}
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
              </>
            )}

            {['deepl', 'gemini', 'deepseek', 'zhipu', 'siliconflow', 'grok', 'groq'].includes(formData.providerType) && (
              <>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">API Key</label>
                  <input
                    type="password"
                    className="w-full border border-input rounded px-3 py-2 bg-background"
                    value={formData.settings.api_key || ''}
                    onChange={(e) => updateSettings('api_key', e.target.value)}
                  />
                </div>
                {formData.providerType === 'deepl' && (
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Endpoint (Optional)</label>
                    <input
                      type="text"
                      className="w-full border border-input rounded px-3 py-2 bg-background"
                      value={formData.settings.endpoint || ''}
                      onChange={(e) => updateSettings('endpoint', e.target.value)}
                      placeholder="https://api.deepl.com"
                    />
                  </div>
                )}
              </>
            )}

            {formData.providerType === 'azure_openai' && (
              <>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">API Key</label>
                  <input
                    type="password"
                    className="w-full border border-input rounded px-3 py-2 bg-background"
                    value={formData.settings.api_key || ''}
                    onChange={(e) => updateSettings('api_key', e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Endpoint</label>
                  <input
                    type="text"
                    className="w-full border border-input rounded px-3 py-2 bg-background"
                    value={formData.settings.endpoint || ''}
                    onChange={(e) => updateSettings('endpoint', e.target.value)}
                    placeholder="https://your-resource.openai.azure.com"
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Deployment Name</label>
                  <input
                    type="text"
                    className="w-full border border-input rounded px-3 py-2 bg-background"
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
                  className="w-full border border-input rounded px-3 py-2 bg-background"
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
                    className="w-full border border-input rounded px-3 py-2 bg-background"
                    value={formData.settings.secret_id || ''}
                    onChange={(e) => updateSettings('secret_id', e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Secret Key</label>
                  <input
                    type="password"
                    className="w-full border border-input rounded px-3 py-2 bg-background"
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
  const [formData, setFormData] = useState<{
    name: string;
    description?: string;
    isActive: boolean;
    isDefault: boolean;
    settings: Record<string, string | number>;
  }>({
    name: provider.name,
    description: provider.description,
    isActive: provider.isActive,
    isDefault: provider.isDefault,
    settings: provider.settings as Record<string, string | number>,
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateProviderRequest) => adminProvidersAPI.update(provider.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const updateSettings = (key: string, value: string | number) => {
    setFormData({ ...formData, settings: { ...formData.settings, [key]: value } });
  };

  const requiresModel = PROVIDERS_WITH_MODEL_FIELD.has(provider.providerType);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center overflow-y-auto">
      <div className="bg-card rounded-lg border border-border p-6 w-full max-w-2xl my-8">
        <h2 className="text-xl font-bold mb-4">Edit Provider</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              className="w-full border border-input rounded px-3 py-2 bg-background"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              className="w-full border border-input rounded px-3 py-2 bg-background"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="font-medium mb-2">Settings</h3>
            
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Max Concurrency</label>
              <input
                type="number"
                className="w-full border border-input rounded px-3 py-2 bg-background"
                value={formData.settings.max_concurrency || 4}
                onChange={(e) => updateSettings('max_concurrency', parseInt(e.target.value))}
                min="1"
                max="100"
              />
              <p className="text-xs text-muted-foreground mt-1">Maximum concurrent translation tasks (1-100)</p>
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Requests Per Minute (RPM)</label>
              <input
                type="number"
                className="w-full border border-input rounded px-3 py-2 bg-background"
                value={formData.settings.requests_per_minute || ''}
                onChange={(e) => updateSettings('requests_per_minute', e.target.value ? parseInt(e.target.value) : '')}
                min="1"
                max="10000"
                placeholder="Optional rate limit"
              />
              <p className="text-xs text-muted-foreground mt-1">API rate limit in requests per minute (optional, 1-10000)</p>
            </div>

            {requiresModel && (
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Model</label>
                <input
                  type="text"
                  className="w-full border border-input rounded px-3 py-2 bg-background"
                  value={formData.settings.model || ''}
                  onChange={(e) => updateSettings('model', e.target.value)}
                />
              </div>
            )}

            {Object.entries(formData.settings)
              .filter(([key]) => !['max_concurrency', 'requests_per_minute', 'model'].includes(key))
              .map(([key, value]) => (
                <div key={key} className="mb-3">
                  <label className="block text-sm font-medium mb-1 capitalize">{key.replace(/_/g, ' ')}</label>
                  <input
                    type={key.includes('key') || key.includes('secret') ? 'password' : 'text'}
                    className="w-full border border-input rounded px-3 py-2 bg-background"
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
