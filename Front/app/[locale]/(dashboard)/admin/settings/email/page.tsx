'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminSettingsAPI, type EmailSettings, type UpdateEmailSettingsRequest } from '@/lib/api/admin-settings';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { SkeletonForm } from '@/components/ui/skeleton';

export default function AdminSettingsEmailPage() {
  const t = useTranslations('settings');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<EmailSettings>({
    queryKey: ['admin', 'settings', 'email'],
    queryFn: adminSettingsAPI.getEmail,
  });

  // Initialize form with defaults
  const [form, setForm] = useState<UpdateEmailSettingsRequest>({
    smtpHost: '',
    smtpPort: 587,
    smtpUsername: '',
    smtpPassword: '',
    smtpUseTLS: true,
    smtpFromEmail: '',
    allowedEmailSuffixes: [],
  });

  // Track the previous data ID to detect when it changes
  const prevDataIdRef = useRef<string | null>(null);

  // Update form when data changes (using effect with proper dependency)
  useEffect(() => {
    // Create a unique ID for the data to track changes
    const dataId = data ? JSON.stringify(data) : null;

    if (data && dataId !== prevDataIdRef.current) {
      prevDataIdRef.current = dataId;
      // Schedule state update for next render
      queueMicrotask(() => {
        setForm({
          smtpHost: data.smtpHost || '',
          smtpPort: data.smtpPort || 587,
          smtpUsername: data.smtpUsername || '',
          smtpPassword: '',
          smtpUseTLS: data.smtpUseTLS,
          smtpFromEmail: data.smtpFromEmail || '',
          allowedEmailSuffixes: data.allowedEmailSuffixes || [],
        });
      });
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: adminSettingsAPI.updateEmail,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 'email'] });
      alert('Updated');
    },
    onError: (e: Error) => alert(e.message),
  });

  const testEmailMutation = useMutation({
    mutationFn: adminSettingsAPI.sendTestEmail,
    onSuccess: (response) => {
      if (response.success) {
        alert(response.message);
      } else {
        alert(`发送失败: ${response.message}`);
      }
    },
    onError: (e: Error) => alert(`发送失败: ${e.message}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Do not send empty password field
    const payload: Partial<UpdateEmailSettingsRequest> = { ...form };
    if (!payload.smtpPassword) delete payload.smtpPassword;
    updateMutation.mutate(payload as UpdateEmailSettingsRequest);
  };

  const handleTestEmail = () => {
    testEmailMutation.mutate();
  };

  if (isLoading) return <SkeletonForm fields={6} />;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">{t('emailConfig')}</h1>
      <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('smtpHost')}</label>
            <input
              type="text"
              className="w-full border-input bg-background border rounded px-3 py-2"
              value={form.smtpHost || ''}
              onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
              placeholder="smtp.example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('smtpPort')}</label>
            <input
              type="number"
              className="w-full border-input bg-background border rounded px-3 py-2"
              value={form.smtpPort || 587}
              onChange={(e) => setForm({ ...form, smtpPort: parseInt(e.target.value || '0', 10) || 0 })}
              min={1}
              max={65535}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('smtpUsername')}</label>
            <input
              type="text"
              className="w-full border-input bg-background border rounded px-3 py-2"
              value={form.smtpUsername || ''}
              onChange={(e) => setForm({ ...form, smtpUsername: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('smtpPassword')}</label>
            <input
              type="password"
              className="w-full border-input bg-background border rounded px-3 py-2"
              value={form.smtpPassword || ''}
              onChange={(e) => setForm({ ...form, smtpPassword: e.target.value })}
              placeholder={t('smtpPasswordPlaceholder')}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="smtpUseTLS"
            type="checkbox"
            className="w-4 h-4 rounded border-input"
            checked={!!form.smtpUseTLS}
            onChange={(e) => setForm({ ...form, smtpUseTLS: e.target.checked })}
          />
          <label htmlFor="smtpUseTLS" className="text-sm font-medium">{t('smtpUseTLS')}</label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('smtpFromEmail')}</label>
          <input
            type="email"
            className="w-full border-input bg-background border rounded px-3 py-2"
            value={form.smtpFromEmail || ''}
            onChange={(e) => setForm({ ...form, smtpFromEmail: e.target.value })}
            placeholder="no-reply@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('allowedEmailSuffixes')}</label>
          <input
            type="text"
            className="w-full border-input bg-background border rounded px-3 py-2"
            value={(form.allowedEmailSuffixes || []).join(', ')}
            onChange={(e) => setForm({ ...form, allowedEmailSuffixes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            placeholder={t('allowedEmailSuffixesPlaceholder')}
          />
          <p className="text-xs text-muted-foreground mt-1">{t('allowedEmailSuffixesHelp')}</p>
        </div>

        <div className="pt-2 flex gap-3">
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? t('saving') : t('saveConfiguration')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleTestEmail}
            disabled={testEmailMutation.isPending}
          >
            {testEmailMutation.isPending ? '发送中...' : '发送测试邮件'}
          </Button>
        </div>
      </form>
    </div>
  );
}

