'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { getAdminTasks } from '@/lib/api/analytics';

export default function AdminTasksPage() {
  const t = useTranslations();
  const [filters, setFilters] = useState({
    ownerEmail: '',
    status: '',
    engine: '',
    priority: '',
    dateFrom: '',
    dateTo: '',
  });
  const [page, setPage] = useState(0);
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tasks', filters, page],
    queryFn: () => getAdminTasks({
      ...filters,
      ownerEmail: filters.ownerEmail || undefined,
      status: filters.status || undefined,
      engine: filters.engine || undefined,
      priority: filters.priority || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      limit,
      offset: page * limit,
    }),
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">{t('admin.tasks.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('admin.tasks.description')}</p>
      </div>

      {/* Filters */}
      <div className="p-6 border rounded-lg bg-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium">{t('admin.tasks.filters')}</h3>
          <button
            onClick={() => {
              setFilters({
                ownerEmail: '',
                status: '',
                engine: '',
                priority: '',
                dateFrom: '',
                dateTo: '',
              });
              setPage(0);
            }}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-muted transition-colors"
          >
            {t('admin.tasks.clearFilters')}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">{t('admin.tasks.filterByEmail')}</label>
            <input
              type="text"
              placeholder={t('admin.tasks.filterByEmail')}
              value={filters.ownerEmail}
              onChange={(e) => handleFilterChange('ownerEmail', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">{t('admin.tasks.status')}</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">{t('admin.tasks.allStatuses')}</option>
              <option value="pending">{t('tasks.status.pending')}</option>
              <option value="processing">{t('tasks.status.processing')}</option>
              <option value="completed">{t('tasks.status.completed')}</option>
              <option value="failed">{t('tasks.status.failed')}</option>
              <option value="cancelled">{t('tasks.status.cancelled')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">{t('admin.tasks.priority')}</label>
            <select
              value={filters.priority}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">{t('admin.tasks.allPriorities')}</option>
              <option value="normal">{t('tasks.priority.normal')}</option>
              <option value="high">{t('tasks.priority.high')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">{t('admin.tasks.dateFrom')}</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">{t('admin.tasks.dateTo')}</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="border rounded-lg bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left py-3 px-4">{t('admin.tasks.documentName')}</th>
                <th className="text-left py-3 px-4">{t('admin.tasks.owner')}</th>
                <th className="text-left py-3 px-4">{t('admin.tasks.status')}</th>
                <th className="text-left py-3 px-4">{t('admin.tasks.priority')}</th>
                <th className="text-right py-3 px-4">{t('admin.tasks.pages')}</th>
                <th className="text-right py-3 px-4">{t('admin.tasks.progress')}</th>
                <th className="text-left py-3 px-4">{t('admin.tasks.createdAt')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : data?.tasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t('admin.tasks.noTasks')}
                  </td>
                </tr>
              ) : (
                data?.tasks.map((task: any) => (
                  <tr key={task.id} className="border-t hover:bg-muted/50">
                    <td className="py-3 px-4">{task.documentName}</td>
                    <td className="py-3 px-4">
                      <div className="text-sm">
                        <div>{task.ownerEmail}</div>
                        <div className="text-xs text-muted-foreground">{task.ownerId}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(task.status)}`}>
                        {t(`tasks.status.${task.status}`)}
                      </span>
                    </td>
                    <td className="py-3 px-4">{t(`tasks.priority.${task.priority}`)}</td>
                    <td className="py-3 px-4 text-right">{task.pageCount}</td>
                    <td className="py-3 px-4 text-right">{task.progress}%</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {new Date(task.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-muted-foreground">
              {t('admin.tasks.showing', {
                from: page * limit + 1,
                to: Math.min((page + 1) * limit, data.total),
                total: data.total,
              })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                {t('common.previous')}
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * limit >= data.total}
                className="px-3 py-1 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
