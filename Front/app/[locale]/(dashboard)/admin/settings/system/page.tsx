'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminSettingsAPI } from '@/lib/api/admin-settings';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { SkeletonForm } from '@/components/ui/skeleton';

export default function AdminSettingsSystemPage() {
  const t = useTranslations('settings');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'settings', 'system'],
    queryFn: adminSettingsAPI.getSystem,
  });

  // Initialize with data or default to false
  const [allowRegistration, setAllowRegistration] = useState(() => data?.allowRegistration ?? false);

  const updateMutation = useMutation({
    mutationFn: adminSettingsAPI.updateSystem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 'system'] });
      alert('Updated');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ allowRegistration });
  };

  if (isLoading) return <SkeletonForm fields={2} />;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">{t('systemConfig')}</h1>
      <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-lg p-6">
        <div className="flex items-start gap-3">
          <input
            id="allowRegistration"
            type="checkbox"
            checked={allowRegistration}
            onChange={(e) => setAllowRegistration(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-input"
          />
          <div>
            <label htmlFor="allowRegistration" className="block text-sm font-medium mb-1">{t('allowRegistration')}</label>
            <p className="text-xs text-muted-foreground">{t('allowRegistrationDescription')}</p>
          </div>
        </div>
        <div className="pt-2">
          <Button type="submit">{t('saveConfiguration')}</Button>
        </div>
      </form>
    </div>
  );
}

