"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GrantAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface User {
  id: string;
  email: string;
  name: string;
}

interface ProviderConfig {
  id: string;
  name: string;
  providerType: string;
}

export function GrantAccessDialog({ open, onOpenChange }: GrantAccessDialogProps) {
  const [formData, setFormData] = useState({
    userId: "",
    providerConfigId: "",
    isDefault: false,
  });

  const queryClient = useQueryClient();

  const { data: users } = useQuery<User[]>({
    queryKey: ["admin", "users"],
    queryFn: () => clientApi.get("/admin/users"),
    enabled: open,
  });

  const { data: providers } = useQuery<ProviderConfig[]>({
    queryKey: ["admin", "providers"],
    queryFn: () => clientApi.get("/admin/providers"),
    enabled: open,
  });

  const grantMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      clientApi.post("/admin/providers/access", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "provider-access"] });
      onOpenChange(false);
      setFormData({
        userId: "",
        providerConfigId: "",
        isDefault: false,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    grantMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>授予服务访问权限</DialogTitle>
          <DialogDescription>
            为用户分配翻译服务的访问权限
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="userId">选择用户</Label>
              <Select
                value={formData.userId}
                onValueChange={(value) =>
                  setFormData({ ...formData, userId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择用户" />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="providerConfigId">选择服务</Label>
              <Select
                value={formData.providerConfigId}
                onValueChange={(value) =>
                  setFormData({ ...formData, providerConfigId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择翻译服务" />
                </SelectTrigger>
                <SelectContent>
                  {providers?.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name} ({provider.providerType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) =>
                    setFormData({ ...formData, isDefault: e.target.checked })
                  }
                  className="rounded border-gray-300"
                />
                <span className="text-sm">设为该用户的默认服务</span>
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
            <Button
              type="submit"
              disabled={
                grantMutation.isPending ||
                !formData.userId ||
                !formData.providerConfigId
              }
            >
              {grantMutation.isPending ? "授予中..." : "授予"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

