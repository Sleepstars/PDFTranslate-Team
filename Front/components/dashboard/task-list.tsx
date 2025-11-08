"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientApi } from "@/lib/http/client";
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
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, RotateCw, X } from "lucide-react";

interface Task {
  id: string;
  documentName: string;
  sourceLang: string;
  targetLang: string;
  status: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
  outputUrl?: string;
  notes?: string;
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
  queued: "secondary",
  processing: "default",
  completed: "success",
  failed: "destructive",
  canceled: "outline",
};

const STATUS_TEXT: Record<string, string> = {
  queued: "排队中",
  processing: "处理中",
  completed: "已完成",
  failed: "失败",
  canceled: "已取消",
};

export function TaskList() {
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: () => clientApi.get("/tasks"),
    refetchInterval: 4000, // Poll every 4 seconds
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "retry" | "cancel" }) =>
      clientApi.post(`/tasks/${id}/${action}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const handleAction = (id: string, action: "retry" | "cancel") => {
    actionMutation.mutate({ id, action });
  };

  const handleDownload = (task: Task) => {
    if (task.outputUrl) {
      window.open(task.outputUrl, "_blank");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>任务列表</CardTitle>
        <CardDescription>
          共 {tasks?.length || 0} 个任务
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            加载中...
          </div>
        ) : !tasks || tasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            暂无任务，创建第一个翻译任务吧
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>文档名称</TableHead>
                <TableHead>语言对</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>进度</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{task.documentName}</div>
                      {task.notes && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {task.notes}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {task.sourceLang} → {task.targetLang}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[task.status] || "outline"}>
                      {STATUS_TEXT[task.status] || task.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Progress value={task.progress} className="w-20" />
                      <span className="text-xs text-muted-foreground">
                        {task.progress}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {new Date(task.updatedAt).toLocaleString("zh-CN")}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {task.status === "completed" && task.outputUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(task)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      {task.status === "failed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAction(task.id, "retry")}
                          disabled={actionMutation.isPending}
                        >
                          <RotateCw className="h-4 w-4" />
                        </Button>
                      )}
                      {(task.status === "queued" || task.status === "processing") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAction(task.id, "cancel")}
                          disabled={actionMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

