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
import type { ProviderConfig, UpdateProviderConfigRequest } from '@/lib/types/provider';

interface ProviderEditDialogProps {
  provider: ProviderConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProviderEditDialog({ provider, open, onOpenChange }: ProviderEditDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<UpdateProviderConfigRequest>({
    name: provider.name,
    description: provider.description,
    isActive: provider.isActive,
    isDefault: provider.isDefault,
    settings: provider.settings,
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateProviderConfigRequest) => 
      adminProvidersApi.updateProvider(provider.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
      onOpenChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const updateSetting = (key: string, value: string) => {
    setFormData({
      ...formData,
      settings: { ...formData.settings, [key]: value },
    });
  };

  const renderSettingsFields = () => {
    const { providerType } = provider;
    const settings = formData.settings || {};

    switch (providerType) {
      case 'google':
        return <p className="text-sm text-muted-foreground">Google Translate 无需额外配置</p>;

      case 'deepl':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="api_key">API Key</Label>
              <Input
                id="api_key"
                type="password"
                value={settings.api_key || ''}
                onChange={(e) => updateSetting('api_key', e.target.value)}
                placeholder="your-deepl-api-key"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api_url">API URL（可选）</Label>
              <Input
                id="api_url"
                value={settings.api_url || ''}
                onChange={(e) => updateSetting('api_url', e.target.value)}
                placeholder="https://api-free.deepl.com/v2/translate"
              />
            </div>
          </>
        );

      case 'openai':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="api_key">API Key</Label>
              <Input
                id="api_key"
                type="password"
                value={settings.api_key || ''}
                onChange={(e) => updateSetting('api_key', e.target.value)}
                placeholder="sk-..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">模型</Label>
              <Input
                id="model"
                value={settings.model || ''}
                onChange={(e) => updateSetting('model', e.target.value)}
                placeholder="gpt-4"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="base_url">Base URL（可选）</Label>
              <Input
                id="base_url"
                value={settings.base_url || ''}
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
              <Label htmlFor="api_key">API Key</Label>
              <Input
                id="api_key"
                type="password"
                value={settings.api_key || ''}
                onChange={(e) => updateSetting('api_key', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endpoint">Endpoint</Label>
              <Input
                id="endpoint"
                value={settings.endpoint || ''}
                onChange={(e) => updateSetting('endpoint', e.target.value)}
                placeholder="https://your-resource.openai.azure.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deployment">Deployment Name</Label>
              <Input
                id="deployment"
                value={settings.deployment || ''}
                onChange={(e) => updateSetting('deployment', e.target.value)}
                placeholder="gpt-4"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">模型（可选）</Label>
              <Input
                id="model"
                value={settings.model || ''}
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
              <Label htmlFor="base_url">Base URL</Label>
              <Input
                id="base_url"
                value={settings.base_url || ''}
                onChange={(e) => updateSetting('base_url', e.target.value)}
                placeholder="http://localhost:11434"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">模型</Label>
              <Input
                id="model"
                value={settings.model || ''}
                onChange={(e) => updateSetting('model', e.target.value)}
                placeholder="llama2"
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
              <Label htmlFor="api_key">API Key</Label>
              <Input
                id="api_key"
                type="password"
                value={settings.api_key || ''}
                onChange={(e) => updateSetting('api_key', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">模型（可选）</Label>
              <Input
                id="model"
                value={settings.model || ''}
                onChange={(e) => updateSetting('model', e.target.value)}
              />
            </div>
          </>
        );

      case 'siliconflow':
        return (
          <div className="space-y-2">
            <Label htmlFor="api_key">API Key</Label>
            <Input
              id="api_key"
              type="password"
              value={settings.api_key || ''}
              onChange={(e) => updateSetting('api_key', e.target.value)}
            />
          </div>
        );

      case 'tencent':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="secret_id">Secret ID</Label>
              <Input
                id="secret_id"
                value={settings.secret_id || ''}
                onChange={(e) => updateSetting('secret_id', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secret_key">Secret Key</Label>
              <Input
                id="secret_key"
                type="password"
                value={settings.secret_key || ''}
                onChange={(e) => updateSetting('secret_key', e.target.value)}
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
          <DialogTitle>编辑服务配置</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">名称</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>服务类型</Label>
            <Input value={provider.providerType} disabled />
            <p className="text-xs text-muted-foreground">服务类型不可修改</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述（可选）</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="isActive">状态</Label>
            <Select
              value={formData.isActive ? 'active' : 'inactive'}
              onValueChange={(value) => setFormData({ ...formData, isActive: value === 'active' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">活跃</SelectItem>
                <SelectItem value="inactive">停用</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="isDefault">设为默认</Label>
            <Select
              value={formData.isDefault ? 'yes' : 'no'}
              onValueChange={(value) => setFormData({ ...formData, isDefault: value === 'yes' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">是</SelectItem>
                <SelectItem value="no">否</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">服务配置</h3>
            {renderSettingsFields()}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

