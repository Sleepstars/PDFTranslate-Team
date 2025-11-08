"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientApi } from "@/lib/http/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { CreateProviderDialog } from "@/components/dashboard/create-provider-dialog";
import { EditProviderDialog } from "@/components/dashboard/edit-provider-dialog";

interface ProviderConfig {
  id: string;
  name: string;
  providerType: string;
  isActive: boolean;
  isDefault: boolean;
  settings: string;
  createdAt: string;
  updatedAt: string;
}

const PROVIDER_TYPE_NAMES: Record<string, string> = {
  google: "Google Translate",
  deepl: "DeepL",
  openai: "OpenAI",
  "azure-openai": "Azure OpenAI",
  ollama: "Ollama",
  deepseek: "DeepSeek",
  gemini: "Google Gemini",
  zhipu: "智谱 AI",
  siliconflow: "SiliconFlow",
  tencent: "腾讯翻译",
  grok: "Grok",
  groq: "Groq",
};

export default function ProvidersPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null);
  const queryClient = useQueryClient();

  const { data: providers, isLoading } = useQuery<ProviderConfig[]>({
    queryKey: ["admin", "providers"],
    queryFn: () => clientApi.get("/admin/providers"),
  });

  const deleteMutation = useMutation({
    mutationFn: (providerId: string) => clientApi.delete(`/admin/providers/${providerId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "providers"] });
    },
  });

  const handleDelete = async (provider: ProviderConfig) => {
    if (confirm(`确定要删除服务配置 ${provider.name} 吗？`)) {
      await deleteMutation.mutateAsync(provider.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">翻译服务配置</h2>
          <p className="text-muted-foreground mt-1">
            管理翻译引擎配置和 API 密钥
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          添加服务
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>服务列表</CardTitle>
          <CardDescription>
            共 {providers?.length || 0} 个翻译服务配置
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              加载中...
            </div>
          ) : !providers || providers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无服务配置
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>服务名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>默认</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell>
                      <div className="font-medium">{provider.name}</div>
                      <div className="text-sm text-muted-foreground">
                        ID: {provider.id}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {PROVIDER_TYPE_NAMES[provider.providerType] || provider.providerType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {provider.isActive ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-sm">活跃</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-600">
                          <XCircle className="h-4 w-4" />
                          <span className="text-sm">禁用</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {provider.isDefault && (
                        <Badge variant="secondary">默认</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {new Date(provider.updatedAt).toLocaleDateString("zh-CN")}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingProvider(provider)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(provider)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateProviderDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {editingProvider && (
        <EditProviderDialog
          provider={editingProvider}
          open={!!editingProvider}
          onOpenChange={(open) => !open && setEditingProvider(null)}
        />
      )}
    </div>
  );
}

