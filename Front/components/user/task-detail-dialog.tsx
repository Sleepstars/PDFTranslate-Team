"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { Task, TaskStatus } from '@/lib/types/task';

interface TaskDetailDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_MAP: Record<TaskStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: '等待中', variant: 'secondary' },
  processing: { label: '处理中', variant: 'default' },
  completed: { label: '已完成', variant: 'outline' },
  failed: { label: '失败', variant: 'destructive' },
  cancelled: { label: '已取消', variant: 'secondary' },
};

export function TaskDetailDialog({ task, open, onOpenChange }: TaskDetailDialogProps) {
  const statusInfo = STATUS_MAP[task.status];

  const handleDownload = () => {
    if (task.outputUrl) {
      window.open(task.outputUrl, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>任务详情</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">文档名称</p>
              <p className="mt-1">{task.documentName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">状态</p>
              <div className="mt-1">
                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">源语言</p>
              <p className="mt-1">{task.sourceLang}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">目标语言</p>
              <p className="mt-1">{task.targetLang}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">翻译引擎</p>
              <p className="mt-1">
                <Badge variant="outline">{task.engine}</Badge>
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">优先级</p>
              <p className="mt-1 capitalize">{task.priority}</p>
            </div>
          </div>

          {task.pageCount && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">页数</p>
              <p className="mt-1">{task.pageCount} 页</p>
            </div>
          )}

          {task.progress !== undefined && task.status === 'processing' && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">进度</p>
              <p className="mt-1">{task.progress}%</p>
            </div>
          )}

          {task.notes && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">备注</p>
              <p className="mt-1">{task.notes}</p>
            </div>
          )}

          {task.errorMessage && (
            <div>
              <p className="text-sm font-medium text-muted-foreground text-red-600">错误信息</p>
              <p className="mt-1 text-red-600">{task.errorMessage}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">创建时间</p>
              <p className="mt-1">{new Date(task.createdAt).toLocaleString('zh-CN')}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">更新时间</p>
              <p className="mt-1">{new Date(task.updatedAt).toLocaleString('zh-CN')}</p>
            </div>
          </div>

          {task.status === 'completed' && task.outputUrl && (
            <div className="pt-4 border-t">
              <Button onClick={handleDownload} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                下载翻译文件
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

