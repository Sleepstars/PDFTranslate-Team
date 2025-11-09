'use client';

import { useQuery } from '@tanstack/react-query';
import { usersAPI } from '@/lib/api/users';
import { tasksAPI } from '@/lib/api/tasks';
import { Badge } from '@/components/ui/badge';
import { Task } from '@/lib/types/task';

export default function DashboardPage() {
  const { data: quota } = useQuery({
    queryKey: ['users', 'quota'],
    queryFn: usersAPI.getQuota,
  });

  const { data: stats } = useQuery({
    queryKey: ['tasks', 'stats'],
    queryFn: tasksAPI.getStats,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-card border border-border rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Daily Quota</h3>
          <div className="text-3xl font-bold">{quota?.dailyPageUsed || 0}/{quota?.dailyPageLimit || 0}</div>
          <p className="text-sm text-muted-foreground mt-1">{quota?.remaining || 0} pages remaining</p>
        </div>

        <div className="bg-card border border-border rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Tasks</h3>
          <div className="text-3xl font-bold">{stats?.total || 0}</div>
        </div>

        <div className="bg-card border border-border rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Completed</h3>
          <div className="text-3xl font-bold text-green-600">{stats?.by_status?.completed || 0}</div>
        </div>
      </div>

      {stats?.by_status && (
        <div className="bg-card border border-border rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Tasks by Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.by_status).map(([status, count]) => (
              <div key={status} className="text-center">
                <div className="text-2xl font-bold">{count as number}</div>
                <div className="text-sm text-muted-foreground capitalize">{status}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats?.recent_activity && stats.recent_activity.length > 0 && (
        <div className="bg-card border border-border rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {stats.recent_activity.slice(0, 5).map((task: Task) => (
              <div key={task.id} className="flex justify-between items-center border-b border-border pb-3">
                <div>
                  <div className="font-medium">{task.documentName}</div>
                  <div className="text-sm text-muted-foreground">
                    {task.sourceLang} → {task.targetLang}
                  </div>
                </div>
                <Badge variant={
                  task.status === 'completed' ? 'success' :
                  task.status === 'failed' ? 'error' :
                  task.status === 'processing' ? 'info' :
                  'secondary'
                }>
                  {task.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
