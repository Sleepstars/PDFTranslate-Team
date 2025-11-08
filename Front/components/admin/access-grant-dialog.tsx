"use client";

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminAccessApi } from '@/lib/api/admin-access';
import { adminUsersApi } from '@/lib/api/admin-users';
import { adminProvidersApi } from '@/lib/api/admin-providers';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { GrantProviderAccessRequest } from '@/lib/types/access';

interface AccessGrantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccessGrantDialog({ open, onOpenChange }: AccessGrantDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<GrantProviderAccessRequest>({
    userId: '',
    providerConfigId: '',
    isDefault: false,
  });

  const { data: users } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminUsersApi.listUsers(),
    enabled: open,
  });

  const { data: providers } = useQuery({
    queryKey: ['admin', 'providers'],
    queryFn: () => adminProvidersApi.listProviders(),
    enabled: open,
  });

  const grantMutation = useMutation({
    mutationFn: (data: GrantProviderAccessRequest) => adminAccessApi.grantAccess(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'access'] });
      onOpenChange(false);
      setFormData({
        userId: '',
        providerConfigId: '',
        isDefault: false,
      });
    },
    onError: (error: Error) => {
      alert(error.message || '授予访问权限失败');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.userId || !formData.providerConfigId) {
      alert('请选择用户和服务');
      return;
    }
    grantMutation.mutate(formData);
  };

  const activeUsers = users?.filter(u => u.isActive) || [];
  const activeProviders = providers?.filter(p => p.isActive) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>授予访问权限</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="userId">用户 *</Label>
            <Select
              value={formData.userId}
              onValueChange={(value) => setFormData({ ...formData, userId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择用户" />
              </SelectTrigger>
              <SelectContent>
                {activeUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="providerConfigId">服务 *</Label>
            <Select
              value={formData.providerConfigId}
              onValueChange={(value) => setFormData({ ...formData, providerConfigId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择服务" />
              </SelectTrigger>
              <SelectContent>
                {activeProviders.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name} ({provider.providerType})
                  </SelectItem>
                ))}
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
                <SelectItem value="no">否</SelectItem>
                <SelectItem value="yes">是</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              设为默认后，该服务将成为用户的首选翻译服务
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={grantMutation.isPending}>
              {grantMutation.isPending ? '授予中...' : '授予'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

