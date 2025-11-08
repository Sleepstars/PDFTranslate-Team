"use client";

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '@/lib/api/tasks';
import { usersApi } from '@/lib/api/users';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CreateTaskRequest, ModelConfig, TaskPriority } from '@/lib/types/task';
import type { ProviderType } from '@/lib/types/provider';

interface TaskCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LANGUAGES = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: '英文' },
  { value: 'ja', label: '日文' },
  { value: 'ko', label: '韩文' },
  { value: 'fr', label: '法文' },
  { value: 'de', label: '德文' },
  { value: 'es', label: '西班牙文' },
  { value: 'ru', label: '俄文' },
];

const ENGINES: { value: ProviderType; label: string }[] = [
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

export function TaskCreateDialog({ open, onOpenChange }: TaskCreateDialogProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState({
    documentName: '',
    sourceLang: 'en',
    targetLang: 'zh',
    engine: 'google' as ProviderType,
    priority: 'normal' as TaskPriority,
    notes: '',
    providerConfigId: '',
  });
  const [advancedConfig, setAdvancedConfig] = useState<ModelConfig>({});

  const { data: providers } = useQuery({
    queryKey: ['user', 'providers'],
    queryFn: () => usersApi.getAvailableProviders(),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateTaskRequest) => tasksApi.createTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['quota'] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      alert(error.message || '创建任务失败');
    },
  });

  const resetForm = () => {
    setFile(null);
    setShowAdvanced(false);
    setFormData({
      documentName: '',
      sourceLang: 'en',
      targetLang: 'zh',
      engine: 'google',
      priority: 'normal',
      notes: '',
      providerConfigId: '',
    });
    setAdvancedConfig({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert('请选择文件');
      return;
    }

    const request: CreateTaskRequest = {
      file,
      documentName: formData.documentName || file.name,
      sourceLang: formData.sourceLang,
      targetLang: formData.targetLang,
      engine: formData.engine,
      priority: formData.priority,
      notes: formData.notes || undefined,
      providerConfigId: formData.providerConfigId || undefined,
      modelConfig: Object.keys(advancedConfig).length > 0 ? advancedConfig : undefined,
    };

    createMutation.mutate(request);
  };

  const updateAdvancedConfig = (key: keyof ModelConfig, value: string) => {
    setAdvancedConfig({ ...advancedConfig, [key]: value });
  };

  const renderAdvancedFields = () => {
    const { engine } = formData;

    switch (engine) {
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
                value={advancedConfig.api_key || ''}
                onChange={(e) => updateAdvancedConfig('api_key', e.target.value)}
                placeholder="临时覆盖 API Key"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endpoint">Endpoint</Label>
              <Input
                id="endpoint"
                value={advancedConfig.endpoint || ''}
                onChange={(e) => updateAdvancedConfig('endpoint', e.target.value)}
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
                value={advancedConfig.api_key || ''}
                onChange={(e) => updateAdvancedConfig('api_key', e.target.value)}
                placeholder="sk-..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">模型</Label>
              <Input
                id="model"
                value={advancedConfig.model || ''}
                onChange={(e) => updateAdvancedConfig('model', e.target.value)}
                placeholder="gpt-4"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endpoint">Base URL</Label>
              <Input
                id="endpoint"
                value={advancedConfig.endpoint || ''}
                onChange={(e) => updateAdvancedConfig('endpoint', e.target.value)}
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
                value={advancedConfig.api_key || ''}
                onChange={(e) => updateAdvancedConfig('api_key', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endpoint">Endpoint</Label>
              <Input
                id="endpoint"
                value={advancedConfig.endpoint || ''}
                onChange={(e) => updateAdvancedConfig('endpoint', e.target.value)}
                placeholder="https://your-resource.openai.azure.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deployment">Deployment</Label>
              <Input
                id="deployment"
                value={advancedConfig.deployment || ''}
                onChange={(e) => updateAdvancedConfig('deployment', e.target.value)}
                placeholder="gpt-4"
              />
            </div>
          </>
        );

      case 'ollama':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="endpoint">Base URL</Label>
              <Input
                id="endpoint"
                value={advancedConfig.endpoint || ''}
                onChange={(e) => updateAdvancedConfig('endpoint', e.target.value)}
                placeholder="http://localhost:11434"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">模型</Label>
              <Input
                id="model"
                value={advancedConfig.model || ''}
                onChange={(e) => updateAdvancedConfig('model', e.target.value)}
                placeholder="llama2"
              />
            </div>
          </>
        );

      case 'tencent':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="secret_id">Secret ID</Label>
              <Input
                id="secret_id"
                value={advancedConfig.secret_id || ''}
                onChange={(e) => updateAdvancedConfig('secret_id', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secret_key">Secret Key</Label>
              <Input
                id="secret_key"
                type="password"
                value={advancedConfig.secret_key || ''}
                onChange={(e) => updateAdvancedConfig('secret_key', e.target.value)}
              />
            </div>
          </>
        );

      case 'gemini':
      case 'deepseek':
      case 'zhipu':
      case 'grok':
      case 'groq':
      case 'siliconflow':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="api_key">API Key</Label>
              <Input
                id="api_key"
                type="password"
                value={advancedConfig.api_key || ''}
                onChange={(e) => updateAdvancedConfig('api_key', e.target.value)}
              />
            </div>
            {engine !== 'siliconflow' && (
              <div className="space-y-2">
                <Label htmlFor="model">模型</Label>
                <Input
                  id="model"
                  value={advancedConfig.model || ''}
                  onChange={(e) => updateAdvancedConfig('model', e.target.value)}
                />
              </div>
            )}
          </>
        );

      default:
        return null;
    }
  };

  const activeProviders = providers?.filter(p => p.isActive) || [];
  const engineProviders = activeProviders.filter(p => p.providerType === formData.engine);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>创建翻译任务</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">PDF 文件 *</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="documentName">文档名称</Label>
            <Input
              id="documentName"
              value={formData.documentName}
              onChange={(e) => setFormData({ ...formData, documentName: e.target.value })}
              placeholder="留空则使用文件名"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sourceLang">源语言 *</Label>
              <Select
                value={formData.sourceLang}
                onValueChange={(value) => setFormData({ ...formData, sourceLang: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetLang">目标语言 *</Label>
              <Select
                value={formData.targetLang}
                onValueChange={(value) => setFormData({ ...formData, targetLang: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="engine">翻译引擎 *</Label>
            <Select
              value={formData.engine}
              onValueChange={(value: ProviderType) => 
                setFormData({ ...formData, engine: value, providerConfigId: '' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENGINES.map((engine) => (
                  <SelectItem key={engine.value} value={engine.value}>
                    {engine.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {engineProviders.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="providerConfigId">使用预配置服务（可选）</Label>
              <Select
                value={formData.providerConfigId}
                onValueChange={(value) => setFormData({ ...formData, providerConfigId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择预配置服务或使用高级配置" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">不使用</SelectItem>
                  {engineProviders.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                      {provider.isDefault && ' (默认)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="priority">优先级</Label>
            <Select
              value={formData.priority}
              onValueChange={(value: TaskPriority) => setFormData({ ...formData, priority: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">低</SelectItem>
                <SelectItem value="normal">普通</SelectItem>
                <SelectItem value="high">高</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">备注（可选）</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <div className="border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full"
            >
              {showAdvanced ? '隐藏' : '显示'}高级配置
            </Button>
            {showAdvanced && (
              <div className="mt-4 space-y-4 p-4 border rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  高级配置将临时覆盖预配置服务的设置（仅对本任务有效）
                </p>
                {renderAdvancedFields()}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? '创建中...' : '创建任务'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

