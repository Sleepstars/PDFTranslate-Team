"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clientApi } from "@/lib/http/client";
import { AlertCircle } from "lucide-react";

interface QuotaStatus {
  dailyPageLimit: number;
  dailyPageUsed: number;
  remainingPages: number;
  lastQuotaReset: string;
}

export function QuotaWidget() {
  const { data: quota, isLoading } = useQuery<QuotaStatus>({
    queryKey: ["quota"],
    queryFn: () => clientApi.get("/users/me/quota"),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  if (isLoading || !quota) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">每日配额</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">--</div>
          <p className="text-xs text-muted-foreground mt-1">加载中...</p>
        </CardContent>
      </Card>
    );
  }

  const usagePercent = (quota.dailyPageUsed / quota.dailyPageLimit) * 100;
  const isLow = usagePercent > 80;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">每日配额</CardTitle>
          {isLow && <AlertCircle className="h-4 w-4 text-destructive" />}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {quota.remainingPages} <span className="text-sm font-normal text-muted-foreground">页</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          已用 {quota.dailyPageUsed} / {quota.dailyPageLimit} 页
          {isLow && <span className="text-destructive ml-1">（配额不足）</span>}
        </p>
        <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              isLow ? "bg-destructive" : "bg-primary"
            }`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

