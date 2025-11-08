"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientApi } from "@/lib/http/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Upload, FileText } from "lucide-react";

interface ProviderConfig {
  id: string;
  name: string;
  providerType: string;
}

interface QuotaStatus {
  dailyPageLimit: number;
  dailyPageUsed: number;
  remainingPages: number;
}

interface CreateTaskFormProps {
  onSuccess?: () => void;
}

export function CreateTaskForm({ onSuccess }: CreateTaskFormProps) {
  const [formData, setFormData] = useState({
    file: null as File | null,
    documentName: "",
    sourceLang: "en",
    targetLang: "zh",
    engine: "google",
    providerConfigId: "",
    priority: "normal",
    notes: "",
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedConfig, setAdvancedConfig] = useState({
    model: "",
    threads: 4,
    endpoint: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [estimatedPages, setEstimatedPages] = useState<number | null>(null);

  const queryClient = useQueryClient();

  const { data: providers } = useQuery<ProviderConfig[]>({
    queryKey: ["user", "providers"],
    queryFn: () => clientApi.get("/users/me/providers"),
  });

  const { data: quota } = useQuery<QuotaStatus>({
    queryKey: ["quota"],
    queryFn: () => clientApi.get("/users/me/quota"),
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const formDataObj = new FormData();
      if (data.file) formDataObj.append("file", data.file);
      formDataObj.append("documentName", data.documentName);
      formDataObj.append("sourceLang", data.sourceLang);
      formDataObj.append("targetLang", data.targetLang);
      formDataObj.append("engine", data.engine);
      formDataObj.append("priority", data.priority);
      if (data.providerConfigId) formDataObj.append("providerConfigId", data.providerConfigId);
      if (data.notes) formDataObj.append("notes", data.notes);

      // Add advanced config if any field is set
      if (showAdvanced && (advancedConfig.model || advancedConfig.endpoint || advancedConfig.threads !== 4)) {
        const modelConfig: Record<string, any> = {};
        if (advancedConfig.model) modelConfig.model = advancedConfig.model;
        if (advancedConfig.endpoint) modelConfig.endpoint = advancedConfig.endpoint;
        if (advancedConfig.threads !== 4) modelConfig.threads = advancedConfig.threads;
        formDataObj.append("modelConfig", JSON.stringify(modelConfig));
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/tasks`, {
        method: "POST",
        credentials: "include",
        body: formDataObj,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "创建任务失败");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["quota"] });
      setFormData({
        file: null,
        documentName: "",
        sourceLang: "en",
        targetLang: "zh",
        engine: "google",
        providerConfigId: "",
        priority: "normal",
        notes: "",
      });
      setAdvancedConfig({
        model: "",
        threads: 4,
        endpoint: "",
      });
      setShowAdvanced(false);
      setEstimatedPages(null);
      setError(null);
      onSuccess?.();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        file,
        documentName: prev.documentName || file.name,
      }));
      // Estimate pages (rough estimate: 1 page ≈ 50KB for PDF)
      const estimatedPageCount = Math.max(1, Math.ceil(file.size / 51200));
      setEstimatedPages(estimatedPageCount);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.file) {
      setError("请选择要翻译的 PDF 文件");
      return;
    }

    if (estimatedPages && quota && estimatedPages > quota.remainingPages) {
      setError(`配额不足：需要约 ${estimatedPages} 页，剩余 ${quota.remainingPages} 页`);
      return;
    }

    createMutation.mutate(formData);
  };

  const canSubmit = formData.file && formData.documentName && !createMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>创建翻译任务</CardTitle>
        <CardDescription>上传 PDF 文件并配置翻译参数</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">PDF 文件</Label>
            <div className="flex items-center gap-2">
              <Input
                id="file"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              {formData.file && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  {formData.file.name}
                </div>
              )}
            </div>
            {estimatedPages && (
              <p className="text-xs text-muted-foreground">
                预估页数: {estimatedPages} 页
                {quota && (
                  <span className={estimatedPages > quota.remainingPages ? "text-destructive ml-1" : "ml-1"}>
                    （剩余配额: {quota.remainingPages} 页）
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="documentName">文档名称</Label>
            <Input
              id="documentName"
              value={formData.documentName}
              onChange={(e) => setFormData({ ...formData, documentName: e.target.value })}
              placeholder="例如: research-paper.pdf"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sourceLang">源语言</Label>
              <Input
                id="sourceLang"
                value={formData.sourceLang}
                onChange={(e) => setFormData({ ...formData, sourceLang: e.target.value })}
                placeholder="en"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetLang">目标语言</Label>
              <Input
                id="targetLang"
                value={formData.targetLang}
                onChange={(e) => setFormData({ ...formData, targetLang: e.target.value })}
                placeholder="zh"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="engine">翻译引擎</Label>
            <Select
              value={formData.engine}
              onValueChange={(value) => setFormData({ ...formData, engine: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google">Google Translate</SelectItem>
                <SelectItem value="deepl">DeepL</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="azure-openai">Azure OpenAI</SelectItem>
                <SelectItem value="ollama">Ollama</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
                <SelectItem value="gemini">Google Gemini</SelectItem>
                <SelectItem value="zhipu">智谱 AI</SelectItem>
                <SelectItem value="siliconflow">SiliconFlow</SelectItem>
                <SelectItem value="tencent">腾讯翻译</SelectItem>
                <SelectItem value="grok">Grok</SelectItem>
                <SelectItem value="groq">Groq</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              或使用下方的"预配置服务"选择管理员配置的服务
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider">预配置服务（可选）</Label>
            <Select
              value={formData.providerConfigId}
              onValueChange={(value) => setFormData({ ...formData, providerConfigId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择预配置服务（留空使用上方引擎）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">不使用预配置服务</SelectItem>
                {providers?.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name} ({provider.providerType})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              预配置服务会覆盖上方的引擎选择和高级配置
            </p>
          </div>

          {/* Advanced Configuration Toggle */}
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full"
            >
              {showAdvanced ? "隐藏高级配置" : "显示高级配置"}
            </Button>
          </div>

          {/* Advanced Configuration Fields */}
          {showAdvanced && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <div className="space-y-2">
                <Label htmlFor="endpoint">API Endpoint（可选）</Label>
                <Input
                  id="endpoint"
                  value={advancedConfig.endpoint}
                  onChange={(e) => setAdvancedConfig({ ...advancedConfig, endpoint: e.target.value })}
                  placeholder="如: https://api.openai.com/v1"
                />
                <p className="text-xs text-muted-foreground">
                  自定义 API 地址，留空使用默认值
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">模型名称（可选）</Label>
                <Input
                  id="model"
                  value={advancedConfig.model}
                  onChange={(e) => setAdvancedConfig({ ...advancedConfig, model: e.target.value })}
                  placeholder="如: gpt-4, gemma2 等"
                />
                <p className="text-xs text-muted-foreground">
                  仅 OpenAI/Ollama 等需要指定模型
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="threads">并发线程数</Label>
                <Input
                  id="threads"
                  type="number"
                  min="1"
                  max="16"
                  value={advancedConfig.threads}
                  onChange={(e) => setAdvancedConfig({ ...advancedConfig, threads: parseInt(e.target.value) || 4 })}
                />
                <p className="text-xs text-muted-foreground">
                  推荐 4-8，过高可能导致 API 限流
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="priority">优先级</Label>
            <Select
              value={formData.priority}
              onValueChange={(value) => setFormData({ ...formData, priority: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">正常</SelectItem>
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
              placeholder="记录特殊指令、页码或术语偏好"
              rows={3}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <Button type="submit" disabled={!canSubmit} className="w-full">
            {createMutation.isPending ? "创建中..." : "创建任务"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

