"use client";

import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  dailyPageLimit: number;
}

interface EditUserDialogProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  const [formData, setFormData] = useState({
    name: user.name,
    isActive: user.isActive,
    dailyPageLimit: user.dailyPageLimit.toString(),
  });

  useEffect(() => {
    setFormData({
      name: user.name,
      isActive: user.isActive,
      dailyPageLimit: user.dailyPageLimit.toString(),
    });
  }, [user]);

  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      clientApi.patch(`/admin/users/${user.id}`, {
        name: data.name,
        isActive: data.isActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  const updateQuotaMutation = useMutation({
    mutationFn: (dailyPageLimit: number) =>
      clientApi.patch(`/admin/users/${user.id}/quota`, { dailyPageLimit }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Update user info
    await updateMutation.mutateAsync({
      name: formData.name,
      isActive: formData.isActive,
      dailyPageLimit: formData.dailyPageLimit,
    });

    // Update quota if changed
    if (parseInt(formData.dailyPageLimit) !== user.dailyPageLimit) {
      await updateQuotaMutation.mutateAsync(parseInt(formData.dailyPageLimit));
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>编辑用户</DialogTitle>
          <DialogDescription>
            修改用户 {user.email} 的信息
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">姓名</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-status">状态</Label>
              <Select
                value={formData.isActive ? "active" : "inactive"}
                onValueChange={(value) =>
                  setFormData({ ...formData, isActive: value === "active" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">活跃</SelectItem>
                  <SelectItem value="inactive">禁用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-dailyPageLimit">每日页数限制</Label>
              <Input
                id="edit-dailyPageLimit"
                type="number"
                min="1"
                value={formData.dailyPageLimit}
                onChange={(e) =>
                  setFormData({ ...formData, dailyPageLimit: e.target.value })
                }
                required
              />
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
              disabled={updateMutation.isPending || updateQuotaMutation.isPending}
            >
              {updateMutation.isPending || updateQuotaMutation.isPending
                ? "保存中..."
                : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

