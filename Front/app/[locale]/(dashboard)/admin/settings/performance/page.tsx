'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminSettingsAPI } from '@/lib/api/admin-settings';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SkeletonForm } from '@/components/ui/skeleton';

export default function AdminSettingsPerformancePage() {
  const t = useTranslations('settings');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'settings', 'performance'],
    queryFn: adminSettingsAPI.getPerformance,
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['admin', 'settings', 'performance', 'metrics'],
    queryFn: adminSettingsAPI.getPerformanceMetrics,
    refetchInterval: 5000, // 每5秒自动刷新
  });

  // Derive state from data using useMemo to avoid setState in effects
  const derivedState = useMemo(() => ({
    maxConcurrentTasks: data?.maxConcurrentTasks ?? 3,
    translationThreads: data?.translationThreads ?? 4,
    queueMonitorInterval: data?.queueMonitorInterval ?? 5,
  }), [data]);

  // Local state for form inputs
  const [maxConcurrentTasks, setMaxConcurrentTasks] = useState(derivedState.maxConcurrentTasks);
  const [translationThreads, setTranslationThreads] = useState(derivedState.translationThreads);
  const [queueMonitorInterval, setQueueMonitorInterval] = useState(derivedState.queueMonitorInterval);

  // Update state when derived state changes
  useEffect(() => {
    setMaxConcurrentTasks(derivedState.maxConcurrentTasks);
    setTranslationThreads(derivedState.translationThreads);
    setQueueMonitorInterval(derivedState.queueMonitorInterval);
  }, [derivedState]);

  const updateMutation = useMutation({
    mutationFn: adminSettingsAPI.updatePerformance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 'performance'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 'performance', 'metrics'] });
      alert(t('performanceSettingsUpdated'));
    },
    onError: (error: Error) => {
      alert(`${t('error')}: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      maxConcurrentTasks,
      translationThreads,
      queueMonitorInterval,
    });
  };

  const handleReset = () => {
    setMaxConcurrentTasks(derivedState.maxConcurrentTasks);
    setTranslationThreads(derivedState.translationThreads);
    setQueueMonitorInterval(derivedState.queueMonitorInterval);
  };

  if (isLoading) return <SkeletonForm fields={3} />;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">{t('performanceConfig')}</h1>

      {/* Performance Metrics */}
      {!metricsLoading && metrics && (
        <div className="mb-6 bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">{t('performanceMetrics')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-background rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">{t('activeTasks')}</div>
              <div className="text-2xl font-bold">{metrics.activeTasks}</div>
            </div>
            <div className="bg-background rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">{t('queuedTasks')}</div>
              <div className="text-2xl font-bold">{metrics.queuedTasks}</div>
            </div>
            <div className="bg-background rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">{t('highPriorityQueue')}</div>
              <div className="text-2xl font-bold">{metrics.highPriorityQueue}</div>
            </div>
            <div className="bg-background rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">{t('normalPriorityQueue')}</div>
              <div className="text-2xl font-bold">{metrics.normalPriorityQueue}</div>
            </div>
            <div className="bg-background rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">{t('lowPriorityQueue')}</div>
              <div className="text-2xl font-bold">{metrics.lowPriorityQueue}</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">{t('metricsAutoRefresh')}</p>
        </div>
      )}

      {/* Configuration Form */}
      <form onSubmit={handleSubmit} className="space-y-6 bg-card border border-border rounded-lg p-6">
        {/* Max Concurrent Tasks */}
        <div>
          <label htmlFor="maxConcurrentTasks" className="block text-sm font-medium mb-2">
            {t('maxConcurrentTasks')}
          </label>
          <Input
            id="maxConcurrentTasks"
            type="number"
            min="1"
            max="50"
            value={maxConcurrentTasks}
            onChange={(e) => setMaxConcurrentTasks(parseInt(e.target.value) || 1)}
            className="max-w-xs"
          />
          <p className="text-xs text-muted-foreground mt-1">{t('maxConcurrentTasksDescription')}</p>
        </div>

        {/* Translation Threads */}
        <div>
          <label htmlFor="translationThreads" className="block text-sm font-medium mb-2">
            {t('translationThreads')}
          </label>
          <Input
            id="translationThreads"
            type="number"
            min="1"
            max="32"
            value={translationThreads}
            onChange={(e) => setTranslationThreads(parseInt(e.target.value) || 1)}
            className="max-w-xs"
          />
          <p className="text-xs text-muted-foreground mt-1">{t('translationThreadsDescription')}</p>
        </div>

        {/* Queue Monitor Interval */}
        <div>
          <label htmlFor="queueMonitorInterval" className="block text-sm font-medium mb-2">
            {t('queueMonitorInterval')}
          </label>
          <Input
            id="queueMonitorInterval"
            type="number"
            min="1"
            max="10"
            value={queueMonitorInterval}
            onChange={(e) => setQueueMonitorInterval(parseInt(e.target.value) || 1)}
            className="max-w-xs"
          />
          <p className="text-xs text-muted-foreground mt-1">{t('queueMonitorIntervalDescription')}</p>
        </div>

        <div className="pt-4 flex gap-3">
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? t('saving') : t('saveConfiguration')}
          </Button>
          <Button type="button" variant="outline" onClick={handleReset}>
            {t('reset')}
          </Button>
        </div>
      </form>
    </div>
  );
}
