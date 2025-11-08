"use client";

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminProvidersApi } from '@/lib/api/admin-providers';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CreateProviderConfigRequest, ProviderType } from '@/lib/types/provider';

interface ProviderCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PROVIDER_TYPES: { value: ProviderType; label: string }[] = [
  { value: 'google', label: 'Google Translate' },
  { value: 'deepl', label: 'DeepL' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'azure-openai', label: 'Azure OpenAI' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'zhipu', label: '智谱 AI' },
  { value: 'siliconflow', label: 'SiliconFlow' },
  { value: 'tencent', label: '腾讯翻译' },
  { value: 'grok', label: 'Grok' },
  { value: 'groq', label: 'Groq' },
];

export function ProviderCreateDialog({ open, onOpenChange }: ProviderCreateDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<CreateProviderConfigRequest>({
    name: '',
    providerType: 'google',
    description: '',
    isActive: true,
    isDefault: false,
    settings: {},
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateProviderConfigRequest) => adminProvidersApi.createProvider(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
      onOpenChange(false);
      setFormData({
        name: '',
        providerType: 'google',
        description: '',
        isActive: true,
        isDefault: false,
        settings: {},
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const updateSetting = (key: string, value: string) => {
    setFormData({
      ...formData,
      settings: { ...formData.settings, [key]: value },
    });
  };

  const renderSettingsFields = () => {
    const { providerType } = formData;

    switch (providerType) {
      case 'google':
        return <p className="text-sm text-muted-foreground">Google Translate 无需额外配置</p>;

      case 'deepl':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="api_key">API Key *</Label>
              <Input
                id="api_key"
                type="password"
                value={formData.settings.api_key || ''}
                onChange={(e) => updateSetting('api_key', e.target.value)}
                placeholder="your-deepl-api-key"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api_url">API URL（可选）</Label>
              <Input
                id="api_url"
                value={formData.settings.api_url || ''}
                onChange={(e) => updateSetting('api_url', e.target.value)}
                placeholder="https://api-free.deepl.com/v2/translate"
              />
              <p className="text-xs text-muted-foreground">免费版和专业版使用不同的 URL</p>
            </div>
          </>
        );

      case 'openai':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="api_key">API Key *</Label>
              <Input
                id="api_key"
                type="password"
                value={formData.settings.api_key || ''}
                onChange={(e) => updateSetting('api_key', e.target.value)}
                placeholder="sk-..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">模型 *</Label>
              <Input
                id="model"
                value={formData.settings.model || ''}
                onChange={(e) => updateSetting('model', e.target.value)}
                placeholder="gpt-4"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="base_url">Base URL（可选）</Label>
              <Input
                id="base_url"
                value={formData.settings.base_url || ''}
                onChange={(e) => updateSetting('base_url', e.target.value)}
                placeholder="https://api.openai.com/v1"
              />
            </div>
          </>
        );

      case 'azure-openai':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="api_key">API Key *</Label>
              <Input
                id="api_key"
                type="password"
                value={formData.settings.api_key || ''}
                onChange={(e) => updateSetting('api_key', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endpoint">Endpoint *</Label>
              <Input
                id="endpoint"
                value={formData.settings.endpoint || ''}
                onChange={(e) => updateSetting('endpoint', e.target.value)}
                placeholder="https://your-resource.openai.azure.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deployment">Deployment Name *</Label>
              <Input
                id="deployment"
                value={formData.settings.deployment || ''}
                onChange={(e) => updateSetting('deployment', e.target.value)}
                placeholder="gpt-4"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">模型（可选）</Label>
              <Input
                id="model"
                value={formData.settings.model || ''}
                onChange={(e) => updateSetting('model', e.target.value)}
                placeholder="gpt-4"
              />
            </div>
          </>
        );

      case 'ollama':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="base_url">Base URL *</Label>
              <Input
                id="base_url"
                value={formData.settings.base_url || ''}
                onChange={(e) => updateSetting('base_url', e.target.value)}
                placeholder="http://localhost:11434"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">模型 *</Label>
              <Input
                id="model"
                value={formData.settings.model || ''}
                onChange={(e) => updateSetting('model', e.target.value)}
                placeholder="llama2"
                required
              />
            </div>
          </>
        );

      case 'gemini':
      case 'deepseek':
      case 'zhipu':
      case 'grok':
      case 'groq':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="api_key">API Key *</Label>
              <Input
                id="api_key"
                type="password"
                value={formData.settings.api_key || ''}
                onChange={(e) => updateSetting('api_key', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">模型（可选）</Label>
              <Input
                id="model"
                value={formData.settings.model || ''}
                onChange={(e) => updateSetting('model', e.target.value)}
                placeholder={
                  providerType === 'gemini' ? 'gemini-pro' :
                  providerType === 'deepseek' ? 'deepseek-chat' :
                  providerType === 'zhipu' ? 'glm-4' :
                  providerType === 'grok' ? 'grok-1' :
                  'llama2-70b-4096'
                }
              />
            </div>
          </>
        );

      case 'siliconflow':
        return (
          <div className="space-y-2">
            <Label htmlFor="api_key">API Key *</Label>
            <Input
              id="api_key"
              type="password"
              value={formData.settings.api_key || ''}
              onChange={(e) => updateSetting('api_key', e.target.value)}
              required
            />
          </div>
        );

      case 'tencent':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="secret_id">Secret ID *</Label>
              <Input
                id="secret_id"
                value={formData.settings.secret_id || ''}
                onChange={(e) => updateSetting('secret_id', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secret_key">Secret Key *</Label>
              <Input
                id="secret_key"
                type="password"
                value={formData.settings.secret_key || ''}
                onChange={(e) => updateSetting('secret_key', e.target.value)}
                required
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>创建服务配置</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">名称 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如: OpenAI GPT-4"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="providerType">服务类型 *</Label>
            <Select
              value={formData.providerType}
              onValueChange={(value: ProviderType) => 
                setFormData({ ...formData, providerType: value, settings: {} })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述（可选）</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="服务配置的描述信息"
              rows={2}
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">服务配置</h3>
            {renderSettingsFields()}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

