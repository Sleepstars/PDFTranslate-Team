"use client";

import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertCircle } from 'lucide-react';

export function QuotaDisplay() {
  const { data: quota, isLoading } = useQuery({
    queryKey: ['quota'],
    queryFn: () => usersApi.getQuota(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  if (isLoading || !quota) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">配额使用</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 flex items-center justify-center text-sm text-muted-foreground">
            加载中...
          </div>
        </CardContent>
      </Card>
    );
  }

  const usagePercent = (quota.dailyPageUsed / quota.dailyPageLimit) * 100;
  const isLowQuota = usagePercent > 80;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">配额使用</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">今日已用</span>
          <span className="font-medium">
            {quota.dailyPageUsed} / {quota.dailyPageLimit} 页
          </span>
        </div>
        
        <Progress value={usagePercent} className="h-2" />
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">剩余</span>
          <span className={isLowQuota ? 'text-orange-600 font-medium' : 'font-medium'}>
            {quota.remaining} 页
          </span>
        </div>

        {isLowQuota && (
          <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 p-2 rounded">
            <AlertCircle className="h-4 w-4" />
            <span>配额即将用尽</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

