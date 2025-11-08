"use client";

import { PageHeader } from '@/components/shared/page-header';
import { QuotaDisplay } from '@/components/shared/quota-display';
import { DashboardStats } from '@/components/user/dashboard-stats';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="仪表盘"
        description="查看您的任务统计和配额使用情况"
      />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <DashboardStats />
        </div>
        <div>
          <QuotaDisplay />
        </div>
      </div>
    </div>
  );
}

