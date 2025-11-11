'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState, useDeferredValue } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getAnalyticsOverview, getDailyStats, getTopUsers } from '@/lib/api/analytics';
import { SkeletonStatCard, SkeletonChart, SkeletonTable } from '@/components/ui/skeleton';
import { Search } from 'lucide-react';

export default function AnalyticsPage() {
  const t = useTranslations();
  const [days, setDays] = useState(30);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);

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

  // 过滤用户数据
  const filteredUsers = topUsers?.users.filter((user) =>
    user.userName.toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
    user.userEmail.toLowerCase().includes(deferredSearchQuery.toLowerCase())
  ) || [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold mb-1">{t('admin.analytics.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('admin.analytics.description')}</p>
      </div>

      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('searchUsers')}
            className="w-full h-9 pl-9 pr-3 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
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
            <div className="p-6 bg-card rounded-lg">
              <div className="text-sm text-muted-foreground">{t('admin.analytics.todayTranslations')}</div>
              <div className="text-3xl font-bold mt-2">{overview?.todayTranslations ?? 0}</div>
            </div>
            <div className="p-6 bg-card rounded-lg">
              <div className="text-sm text-muted-foreground">{t('admin.analytics.todayPages')}</div>
              <div className="text-3xl font-bold mt-2">{overview?.todayPages ?? 0}</div>
            </div>
            <div className="p-6 bg-card rounded-lg">
              <div className="text-sm text-muted-foreground">{t('admin.analytics.totalUsers')}</div>
              <div className="text-3xl font-bold mt-2">{overview?.totalUsers ?? 0}</div>
            </div>
            <div className="p-6 bg-card rounded-lg">
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
        <div className="p-6 bg-card rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">{t('admin.analytics.dailyTrend')}</h2>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-3 py-1 border border-border bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
        <div className="bg-card rounded-lg">
          <div className="p-6 border-b border-border/50">
            <h2 className="text-lg font-medium">{t('admin.analytics.topUsers')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-muted/50 border-b border-border/50">
                <tr className="text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">{t('admin.analytics.userName')}</th>
                  <th className="px-4 py-2.5 text-left font-medium">{t('admin.analytics.userEmail')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t('admin.analytics.totalTasks')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t('admin.analytics.totalPages')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredUsers.map((user) => (
                  <tr key={user.userId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 text-sm font-medium">{user.userName}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">{user.userEmail}</td>
                    <td className="px-4 py-2.5 text-sm text-right">{user.totalTasks}</td>
                    <td className="px-4 py-2.5 text-sm text-right font-semibold">{user.totalPages}</td>
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
