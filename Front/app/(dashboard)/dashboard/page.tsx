import { redirect } from 'next/navigation';
import { TaskBoard } from '@/components/dashboard/task-board';
import { getCurrentUser } from '@/lib/auth/session';
import { fetchTasksServer } from '@/lib/tasks/server';
import { QuotaWidget } from '@/components/dashboard/quota-widget';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const initialTasks = await fetchTasksServer();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">总任务</p>
          <h3 className="text-2xl font-bold mt-2">{initialTasks.length}</h3>
          <p className="text-xs text-muted-foreground mt-1">自启动以来提交的任务数量</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">待处理</p>
          <h3 className="text-2xl font-bold mt-2">
            {initialTasks.filter((task) => task.status === 'queued' || task.status === 'processing').length}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">当前队列中的任务</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">成功率</p>
          <h3 className="text-2xl font-bold mt-2">
            {initialTasks.length
              ? Math.round(
                  (initialTasks.filter((task) => task.status === 'completed').length / initialTasks.length) * 100
                )
              : 0}
            %
          </h3>
          <p className="text-xs text-muted-foreground mt-1">模拟 Worker 完成度</p>
        </div>
        <QuotaWidget />
      </div>

      <TaskBoard initialTasks={initialTasks} />
    </div>
  );
}
