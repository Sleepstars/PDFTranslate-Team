'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getAnalyticsOverview, getDailyStats, getTopUsers } from '@/lib/api/analytics';
import { SkeletonStatCard, SkeletonChart, SkeletonTable } from '@/components/ui/skeleton';

export default function AnalyticsPage() {
  const t = useTranslations();
  const [days, setDays] = useState(30);

  const { data: overview, isLoading: isLoadingOverview } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: getAnalyticsOverview,
  });

  const { data: dailyStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['daily-stats', days],
    queryFn: () => getDailyStats(days),
  });

  const { data: topUsers, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['top-users'],
    queryFn: () => getTopUsers(10),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">{t('admin.analytics.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('admin.analytics.description')}</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoadingOverview ? (
          <>
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
          </>
        ) : (
          <>
            <div className="p-6 border rounded-lg bg-card">
              <div className="text-sm text-muted-foreground">{t('admin.analytics.todayTranslations')}</div>
              <div className="text-3xl font-bold mt-2">{overview?.todayTranslations ?? 0}</div>
            </div>
            <div className="p-6 border rounded-lg bg-card">
              <div className="text-sm text-muted-foreground">{t('admin.analytics.todayPages')}</div>
              <div className="text-3xl font-bold mt-2">{overview?.todayPages ?? 0}</div>
            </div>
            <div className="p-6 border rounded-lg bg-card">
              <div className="text-sm text-muted-foreground">{t('admin.analytics.totalUsers')}</div>
              <div className="text-3xl font-bold mt-2">{overview?.totalUsers ?? 0}</div>
            </div>
            <div className="p-6 border rounded-lg bg-card">
              <div className="text-sm text-muted-foreground">{t('admin.analytics.activeUsers')}</div>
              <div className="text-3xl font-bold mt-2">{overview?.activeUsers ?? 0}</div>
            </div>
          </>
        )}
      </div>

      {/* Daily Stats Chart */}
      {isLoadingStats ? (
        <SkeletonChart />
      ) : (
        <div className="p-6 border rounded-lg bg-card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">{t('admin.analytics.dailyTrend')}</h2>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-3 py-1 border rounded-md"
            >
              <option value={7}>7 {t('admin.analytics.days')}</option>
              <option value={30}>30 {t('admin.analytics.days')}</option>
              <option value={90}>90 {t('admin.analytics.days')}</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyStats?.stats ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="translations"
                stroke="#8884d8"
                name={t('admin.analytics.translations')}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="pages"
                stroke="#82ca9d"
                name={t('admin.analytics.pages')}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Users Table */}
      {isLoadingUsers ? (
        <SkeletonTable rows={10} columns={4} />
      ) : (
        <div className="p-6 border rounded-lg bg-card">
          <h2 className="text-lg font-medium mb-4">{t('admin.analytics.topUsers')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">{t('admin.analytics.userName')}</th>
                  <th className="text-left py-2">{t('admin.analytics.userEmail')}</th>
                  <th className="text-right py-2">{t('admin.analytics.totalTasks')}</th>
                  <th className="text-right py-2">{t('admin.analytics.totalPages')}</th>
                </tr>
              </thead>
              <tbody>
                {topUsers?.users.map((user) => (
                  <tr key={user.userId} className="border-b">
                    <td className="py-2">{user.userName}</td>
                    <td className="py-2 text-muted-foreground">{user.userEmail}</td>
                    <td className="py-2 text-right">{user.totalTasks}</td>
                    <td className="py-2 text-right font-semibold">{user.totalPages}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
