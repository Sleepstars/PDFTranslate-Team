"use client";

import { useQuery } from '@tanstack/react-query';
import { tasksApi } from '@/lib/api/tasks';
import { usersApi } from '@/lib/api/users';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, CheckCircle, Clock, XCircle } from 'lucide-react';

export function DashboardStats() {
  const { data: stats } = useQuery({
    queryKey: ['tasks', 'stats'],
    queryFn: () => tasksApi.getStats(),
  });

  const { data: quota } = useQuery({
    queryKey: ['quota'],
    queryFn: () => usersApi.getQuota(),
  });

  const statCards = [
    {
      title: '总任务数',
      value: stats?.total || 0,
      icon: FileText,
      color: 'text-blue-600',
    },
    {
      title: '已完成',
      value: stats?.completed || 0,
      icon: CheckCircle,
      color: 'text-green-600',
    },
    {
      title: '处理中',
      value: stats?.processing || 0,
      icon: Clock,
      color: 'text-yellow-600',
    },
    {
      title: '失败',
      value: stats?.failed || 0,
      icon: XCircle,
      color: 'text-red-600',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

