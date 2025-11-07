import { redirect } from 'next/navigation';
import { TaskBoard } from '@/components/dashboard/task-board';
import { getCurrentUser } from '@/lib/auth/session';
import { fetchTasksServer } from '@/lib/tasks/server';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const initialTasks = await fetchTasksServer();

  return (
    <div className="dashboard-page">
      <section className="stats-row">
        <article className="stat-card">
          <p className="stat-label">总任务</p>
          <h3>{initialTasks.length}</h3>
          <span>自启动以来提交的任务数量</span>
        </article>
        <article className="stat-card">
          <p className="stat-label">待处理</p>
          <h3>{initialTasks.filter((task) => task.status === 'queued' || task.status === 'processing').length}</h3>
          <span>当前队列中的任务</span>
        </article>
        <article className="stat-card">
          <p className="stat-label">成功率</p>
          <h3>
            {initialTasks.length
              ? Math.round(
                  (initialTasks.filter((task) => task.status === 'completed').length / initialTasks.length) * 100
                )
              : 0}
            %
          </h3>
          <span>模拟 Worker 完成度</span>
        </article>
      </section>

      <TaskBoard initialTasks={initialTasks} />
    </div>
  );
}
