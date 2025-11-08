"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '@/lib/api/tasks';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Download, RotateCw, XCircle, Eye } from 'lucide-react';
import { TaskDetailDialog } from './task-detail-dialog';
import type { Task, TaskStatus } from '@/lib/types/task';

const STATUS_MAP: Record<TaskStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: '等待中', variant: 'secondary' },
  processing: { label: '处理中', variant: 'default' },
  completed: { label: '已完成', variant: 'outline' },
  failed: { label: '失败', variant: 'destructive' },
  cancelled: { label: '已取消', variant: 'secondary' },
};

export function TaskList() {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.listTasks({}),
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });

  const updateMutation = useMutation({
    mutationFn: ({ taskId, action }: { taskId: string; action: 'cancel' | 'retry' }) =>
      tasksApi.updateTask(taskId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'stats'] });
    },
  });

  const handleDownload = (task: Task) => {
    if (task.outputUrl) {
      window.open(task.outputUrl, '_blank');
    }
  };

  const handleCancel = (taskId: string) => {
    if (confirm('确定要取消此任务吗？')) {
      updateMutation.mutate({ taskId, action: 'cancel' });
    }
  };

  const handleRetry = (taskId: string) => {
    if (confirm('确定要重试此任务吗？')) {
      updateMutation.mutate({ taskId, action: 'retry' });
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">加载中...</div>;
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        暂无任务
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>文档名称</TableHead>
              <TableHead>语言</TableHead>
              <TableHead>引擎</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>进度</TableHead>
              <TableHead>页数</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              const statusInfo = STATUS_MAP[task.status];
              return (
                <TableRow key={task.id}>
                  <TableCell className="font-medium max-w-xs truncate">
                    {task.documentName}
                  </TableCell>
                  <TableCell>
                    {task.sourceLang} → {task.targetLang}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{task.engine}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusInfo.variant}>
                      {statusInfo.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {task.status === 'processing' && task.progress !== undefined ? (
                      <div className="w-24">
                        <Progress value={task.progress} className="h-2" />
                        <span className="text-xs text-muted-foreground">
                          {task.progress}%
                        </span>
                      </div>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>{task.pageCount || '-'}</TableCell>
                  <TableCell>
                    {new Date(task.createdAt).toLocaleString('zh-CN')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedTask(task)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {task.status === 'completed' && task.outputUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(task)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      {task.status === 'failed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRetry(task.id)}
                          disabled={updateMutation.isPending}
                        >
                          <RotateCw className="h-4 w-4" />
                        </Button>
                      )}
                      {(task.status === 'pending' || task.status === 'processing') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancel(task.id)}
                          disabled={updateMutation.isPending}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
        />
      )}
    </>
  );
}

