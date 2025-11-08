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
import { Textarea } from "@/components/ui/textarea";

interface ProviderConfig {
  id: string;
  name: string;
  providerType: string;
  isActive: boolean;
  isDefault: boolean;
  settings: string;
}

interface EditProviderDialogProps {
  provider: ProviderConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProviderDialog({ provider, open, onOpenChange }: EditProviderDialogProps) {
  const [formData, setFormData] = useState({
    name: provider.name,
    isActive: provider.isActive,
    isDefault: provider.isDefault,
    settings: provider.settings,
  });

  useEffect(() => {
    setFormData({
      name: provider.name,
      isActive: provider.isActive,
      isDefault: provider.isDefault,
      settings: provider.settings,
    });
  }, [provider]);

  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      clientApi.patch(`/admin/providers/${provider.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "providers"] });
      onOpenChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate JSON
    try {
      JSON.parse(formData.settings);
    } catch (error) {
      alert("设置必须是有效的 JSON 格式");
      return;
    }

    updateMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>编辑服务配置</DialogTitle>
          <DialogDescription>
            修改 {provider.id} 的配置
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>服务 ID</Label>
              <Input value={provider.id} disabled className="bg-muted" />
            </div>
            <div className="grid gap-2">
              <Label>服务类型</Label>
              <Input value={provider.providerType} disabled className="bg-muted" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-name">服务名称</Label>
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
              <Label htmlFor="edit-settings">配置设置 (JSON)</Label>
              <Textarea
                id="edit-settings"
                value={formData.settings}
                onChange={(e) =>
                  setFormData({ ...formData, settings: e.target.value })
                }
                rows={8}
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
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

