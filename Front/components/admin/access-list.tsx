"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAccessApi } from '@/lib/api/admin-access';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';

export function AccessList() {
  const queryClient = useQueryClient();

  const { data: accesses, isLoading } = useQuery({
    queryKey: ['admin', 'access'],
    queryFn: () => adminAccessApi.listAllAccess(),
  });

  const revokeMutation = useMutation({
    mutationFn: (accessId: string) => adminAccessApi.revokeAccess(accessId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'access'] });
    },
  });

  const handleRevoke = (accessId: string, userName: string, providerName: string) => {
    if (confirm(`确定要撤销 ${userName} 对 ${providerName} 的访问权限吗？`)) {
      revokeMutation.mutate(accessId);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">加载中...</div>;
  }

  if (!accesses || accesses.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        暂无访问授权
      </div>
    );
  }

  // Group by user
  const groupedByUser = accesses.reduce((acc, access) => {
    const userId = access.userId;
    if (!acc[userId]) {
      acc[userId] = [];
    }
    acc[userId].push(access);
    return acc;
  }, {} as Record<string, typeof accesses>);

  return (
    <div className="space-y-6">
      {Object.entries(groupedByUser).map(([userId, userAccesses]) => {
        const firstAccess = userAccesses[0];
        const userName = firstAccess.user?.name || '未知用户';
        const userEmail = firstAccess.user?.email || '';

        return (
          <div key={userId} className="border rounded-lg">
            <div className="bg-muted px-4 py-3 border-b">
              <h3 className="font-medium">{userName}</h3>
              <p className="text-sm text-muted-foreground">{userEmail}</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>服务名称</TableHead>
                  <TableHead>服务类型</TableHead>
                  <TableHead>默认</TableHead>
                  <TableHead>授权时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userAccesses.map((access) => (
                  <TableRow key={access.id}>
                    <TableCell className="font-medium">
                      {access.provider?.name || '未知服务'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {access.provider?.providerType || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {access.isDefault && <Badge>默认</Badge>}
                    </TableCell>
                    <TableCell>
                      {new Date(access.createdAt).toLocaleDateString('zh-CN')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(
                          access.id,
                          userName,
                          access.provider?.name || '未知服务'
                        )}
                        disabled={revokeMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      })}
    </div>
  );
}

