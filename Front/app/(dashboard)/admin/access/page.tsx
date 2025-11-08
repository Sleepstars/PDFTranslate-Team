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
import { Plus, Trash2, Star } from "lucide-react";
import { GrantAccessDialog } from "@/components/dashboard/grant-access-dialog";

interface UserProviderAccess {
  id: string;
  userId: string;
  providerConfigId: string;
  isDefault: boolean;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
  provider: {
    id: string;
    name: string;
    providerType: string;
  };
}

export default function AccessPage() {
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: accessList, isLoading } = useQuery<UserProviderAccess[]>({
    queryKey: ["admin", "provider-access"],
    queryFn: () => clientApi.get("/admin/providers/access/all"),
  });

  const revokeMutation = useMutation({
    mutationFn: (accessId: string) =>
      clientApi.delete(`/admin/providers/access/${accessId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "provider-access"] });
    },
  });

  const handleRevoke = async (access: UserProviderAccess) => {
    if (
      confirm(
        `确定要撤销用户 ${access.user.name} 对服务 ${access.provider.name} 的访问权限吗？`
      )
    ) {
      await revokeMutation.mutateAsync(access.id);
    }
  };

  // Group by user
  const groupedByUser = accessList?.reduce((acc, access) => {
    const userId = access.userId;
    if (!acc[userId]) {
      acc[userId] = {
        user: access.user,
        accesses: [],
      };
    }
    acc[userId].accesses.push(access);
    return acc;
  }, {} as Record<string, { user: UserProviderAccess["user"]; accesses: UserProviderAccess[] }>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">服务访问管理</h2>
          <p className="text-muted-foreground mt-1">
            管理用户对翻译服务的访问权限
          </p>
        </div>
        <Button onClick={() => setGrantDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          授予访问权限
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>访问权限列表</CardTitle>
          <CardDescription>
            共 {accessList?.length || 0} 条访问授权
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              加载中...
            </div>
          ) : !accessList || accessList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无访问授权
            </div>
          ) : (
            <div className="space-y-6">
              {Object.values(groupedByUser || {}).map(({ user, accesses }) => (
                <div key={user.id} className="border rounded-lg p-4">
                  <div className="mb-3">
                    <h3 className="font-semibold">{user.name}</h3>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
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
                      {accesses.map((access) => (
                        <TableRow key={access.id}>
                          <TableCell>
                            <div className="font-medium">{access.provider.name}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {access.provider.providerType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {access.isDefault && (
                              <Badge variant="secondary" className="gap-1">
                                <Star className="h-3 w-3" />
                                默认
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {new Date(access.createdAt).toLocaleDateString("zh-CN")}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRevoke(access)}
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <GrantAccessDialog
        open={grantDialogOpen}
        onOpenChange={setGrantDialogOpen}
      />
    </div>
  );
}

