"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clientApi } from "@/lib/http/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface CreateProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PROVIDER_TYPES = [
  { value: "google", label: "Google Translate" },
  { value: "deepl", label: "DeepL" },
  { value: "openai", label: "OpenAI" },
  { value: "azure-openai", label: "Azure OpenAI" },
  { value: "ollama", label: "Ollama" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "gemini", label: "Google Gemini" },
  { value: "zhipu", label: "智谱 AI" },
  { value: "siliconflow", label: "SiliconFlow" },
  { value: "tencent", label: "腾讯翻译" },
  { value: "grok", label: "Grok" },
  { value: "groq", label: "Groq" },
];

const PROVIDER_SETTINGS_EXAMPLES: Record<string, string> = {
  google: "{}",
  deepl: '{"api_key": "your-api-key"}',
  openai: '{"api_key": "sk-...", "model": "gpt-4", "base_url": "https://api.openai.com/v1"}',
  "azure-openai": '{"api_key": "...", "endpoint": "https://...", "deployment": "gpt-4"}',
  ollama: '{"base_url": "http://localhost:11434", "model": "llama2"}',
  deepseek: '{"api_key": "...", "model": "deepseek-chat"}',
  gemini: '{"api_key": "...", "model": "gemini-pro"}',
  zhipu: '{"api_key": "...", "model": "glm-4"}',
};

export function CreateProviderDialog({ open, onOpenChange }: CreateProviderDialogProps) {
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    providerType: "google",
    isActive: true,
    isDefault: false,
    settings: "{}",
  });

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      clientApi.post("/admin/providers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "providers"] });
      onOpenChange(false);
      setFormData({
        id: "",
        name: "",
        providerType: "google",
        isActive: true,
        isDefault: false,
        settings: "{}",
      });
    },
  });

  const handleProviderTypeChange = (type: string) => {
    setFormData({
      ...formData,
      providerType: type,
      settings: PROVIDER_SETTINGS_EXAMPLES[type] || "{}",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate JSON
    try {
      JSON.parse(formData.settings);
    } catch (error) {
      alert("设置必须是有效的 JSON 格式");
      return;
    }

    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>添加翻译服务</DialogTitle>
          <DialogDescription>
            配置新的翻译引擎服务
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="id">服务 ID</Label>
              <Input
                id="id"
                placeholder="例如: google-default, openai-gpt4"
                value={formData.id}
                onChange={(e) =>
                  setFormData({ ...formData, id: e.target.value })
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                唯一标识符，只能包含字母、数字、连字符
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">服务名称</Label>
              <Input
                id="name"
                placeholder="例如: Google 翻译（免费）"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="providerType">服务类型</Label>
              <Select
                value={formData.providerType}
                onValueChange={handleProviderTypeChange}
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
            <div className="grid gap-2">
              <Label htmlFor="settings">配置设置 (JSON)</Label>
              <Textarea
                id="settings"
                value={formData.settings}
                onChange={(e) =>
                  setFormData({ ...formData, settings: e.target.value })
                }
                rows={6}
                className="font-mono text-xs"
                required
              />
              <p className="text-xs text-muted-foreground">
                JSON 格式的服务配置，包含 API 密钥等信息
              </p>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="rounded border-gray-300"
                />
                <span className="text-sm">启用服务</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) =>
                    setFormData({ ...formData, isDefault: e.target.checked })
                  }
                  className="rounded border-gray-300"
                />
                <span className="text-sm">设为默认</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

