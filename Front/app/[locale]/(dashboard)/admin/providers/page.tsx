'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminProvidersAPI } from '@/lib/api/admin-providers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProviderConfig, UpdateProviderRequest } from '@/lib/types/provider';
import { useAdminUpdates } from '@/lib/hooks/use-admin-updates';
import { useTranslations } from 'next-intl';

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
  const isRealtimeConnected = useAdminUpdates('providers');
  const t = useTranslations('providers');
  const tCommon = useTranslations('common');

  const getProviderTypeDescription = (type: string) => {
    return t(`types.${type}`) || type;
  };

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['admin', 'providers'],
    queryFn: adminProvidersAPI.list,
    refetchOnWindowFocus: !isRealtimeConnected,
  });

  const deleteMutation = useMutation({
    mutationFn: adminProvidersAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
    },
  });

  if (isLoading) return <div className="flex items-center justify-center h-64">{tCommon('loading')}</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold mb-1">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => setShowDialog(true)} size="sm" className="h-9">
          + {t('create')}
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-visible">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border">
            <tr className="text-xs text-muted-foreground">
              <th className="px-4 py-2.5 text-left font-medium">{t('name')}</th>
              <th className="px-4 py-2.5 text-left font-medium">{t('type')}</th>
              <th className="px-4 py-2.5 text-left font-medium">{t('description')}</th>
              <th className="px-4 py-2.5 text-left font-medium">{t('status')}</th>
              <th className="px-4 py-2.5 text-left font-medium">{t('default')}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {providers.map((provider: ProviderConfig) => (
              <tr key={provider.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 text-sm font-medium">{provider.name}</td>
                <td className="px-4 py-2.5">
                  <Badge variant="info" className="text-xs">{getProviderTypeDescription(provider.providerType)}</Badge>
                </td>
                <td className="px-4 py-2.5 text-sm">{provider.description || '-'}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={provider.isActive ? 'success' : 'error'} className="text-xs">
                    {provider.isActive ? t('active') : t('inactive')}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  {provider.isDefault && <Badge variant="warning" className="text-xs">{t('default')}</Badge>}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="relative inline-block">
                    <button
                      onClick={() => setEditProvider(provider)}
                      className="p-1 hover:bg-muted rounded transition-colors mr-1"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(provider.id)}
                      className="p-1 hover:bg-muted rounded transition-colors text-destructive"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
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
  const t = useTranslations('providers.createDialog');
  const tCommon = useTranslations('common');
  const tProviders = useTranslations('providers');

  const getProviderTypeDescription = (type: string) => {
    return tProviders(`types.${type}`) || type;
  };

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
        <h2 className="text-xl font-bold mb-4">{t('title')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('name')}</label>
            <input
              type="text"
              className="w-full border border-input rounded px-3 py-2 bg-background"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('providerType')}</label>
            <select
              className="w-full border border-input rounded px-3 py-2 bg-background"
              value={formData.providerType}
              onChange={(e) => setFormData({ ...formData, providerType: e.target.value, settings: {} })}
            >
              {PROVIDER_TYPES.map(type => (
                <option key={type} value={type}>{getProviderTypeDescription(type)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('description')}</label>
            <textarea
              className="w-full border border-input rounded px-3 py-2 bg-background"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="font-medium mb-2">{t('settings')}</h3>
            
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">{t('maxConcurrency')}</label>
              <input
                type="number"
                className="w-full border border-input rounded px-3 py-2 bg-background"
                value={formData.settings.max_concurrency || 4}
                onChange={(e) => updateSettings('max_concurrency', parseInt(e.target.value))}
                min="1"
                max="100"
              />
              <p className="text-xs text-muted-foreground mt-1">{t('maxConcurrencyDescription')}</p>
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">{t('requestsPerMinute')}</label>
              <input
                type="number"
                className="w-full border border-input rounded px-3 py-2 bg-background"
                value={formData.settings.requests_per_minute || ''}
                onChange={(e) => updateSettings('requests_per_minute', e.target.value ? parseInt(e.target.value) : '')}
                min="1"
                max="10000"
                placeholder="Optional rate limit"
              />
              <p className="text-xs text-muted-foreground mt-1">{t('rpmDescription')}</p>
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
                  <label className="block text-sm font-medium mb-1">{t('apiKey')}</label>
                  <input
                    type="password"
                    className="w-full border border-input rounded px-3 py-2 bg-background"
                    value={formData.settings.api_key || ''}
                    onChange={(e) => updateSettings('api_key', e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">{t('baseUrl')}</label>
                  <input
                    type="text"
                    className="w-full border border-input rounded px-3 py-2 bg-background"
                    value={formData.settings.base_url || ''}
                    onChange={(e) => updateSettings('base_url', e.target.value)}
                    placeholder={t('baseUrlPlaceholder')}
                  />
                </div>
              </>
            )}

            {['deepl', 'gemini', 'deepseek', 'zhipu', 'siliconflow', 'grok', 'groq'].includes(formData.providerType) && (
              <>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">{t('apiKey')}</label>
                  <input
                    type="password"
                    className="w-full border border-input rounded px-3 py-2 bg-background"
                    value={formData.settings.api_key || ''}
                    onChange={(e) => updateSettings('api_key', e.target.value)}
                  />
                </div>
                {formData.providerType === 'deepl' && (
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">{t('endpointOptional')}</label>
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
                  <label className="block text-sm font-medium mb-1">{t('apiKey')}</label>
                  <input
                    type="password"
                    className="w-full border border-input rounded px-3 py-2 bg-background"
                    value={formData.settings.api_key || ''}
                    onChange={(e) => updateSettings('api_key', e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">{t('endpoint')}</label>
                  <input
                    type="text"
                    className="w-full border border-input rounded px-3 py-2 bg-background"
                    value={formData.settings.endpoint || ''}
                    onChange={(e) => updateSettings('endpoint', e.target.value)}
                    placeholder="https://your-resource.openai.azure.com"
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">{t('deploymentName')}</label>
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
                <label className="block text-sm font-medium mb-1">{t('endpoint')}</label>
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
                  <label className="block text-sm font-medium mb-1">{t('secretId')}</label>
                  <input
                    type="text"
                    className="w-full border border-input rounded px-3 py-2 bg-background"
                    value={formData.settings.secret_id || ''}
                    onChange={(e) => updateSettings('secret_id', e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">{t('secretKey')}</label>
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
              <span className="text-sm font-medium">{t('active')}</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm font-medium">{t('setAsDefault')}</span>
            </label>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>{t('cancel')}</Button>
            <Button type="submit">{t('create')}</Button>
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
