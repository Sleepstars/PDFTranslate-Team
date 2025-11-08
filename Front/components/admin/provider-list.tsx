"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminProvidersApi } from '@/lib/api/admin-providers';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2 } from 'lucide-react';
import { ProviderEditDialog } from './provider-edit-dialog';
import type { ProviderConfig } from '@/lib/types/provider';

export function ProviderList() {
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null);
  const queryClient = useQueryClient();

  const { data: providers, isLoading } = useQuery({
    queryKey: ['admin', 'providers'],
    queryFn: () => adminProvidersApi.listProviders(),
  });

  const deleteMutation = useMutation({
    mutationFn: (providerId: string) => adminProvidersApi.deleteProvider(providerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
    },
  });

  const handleDelete = (provider: ProviderConfig) => {
    if (confirm(`确定要删除服务配置 ${provider.name} 吗？`)) {
      deleteMutation.mutate(provider.id);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">加载中...</div>;
  }

  if (!providers || providers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        暂无服务配置
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>描述</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>默认</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.map((provider) => (
              <TableRow key={provider.id}>
                <TableCell className="font-medium">{provider.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{provider.providerType}</Badge>
                </TableCell>
                <TableCell className="max-w-xs truncate">
                  {provider.description || '-'}
                </TableCell>
                <TableCell>
                  <Badge variant={provider.isActive ? 'default' : 'secondary'}>
                    {provider.isActive ? '活跃' : '停用'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {provider.isDefault && <Badge>默认</Badge>}
                </TableCell>
                <TableCell>
                  {new Date(provider.createdAt).toLocaleDateString('zh-CN')}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingProvider(provider)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
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
      </div>

      {editingProvider && (
        <ProviderEditDialog
          provider={editingProvider}
          open={!!editingProvider}
          onOpenChange={(open) => !open && setEditingProvider(null)}
        />
      )}
    </>
  );
}

