'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminSettingsAPI, S3ConfigRequest } from '@/lib/api/admin-settings';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { SkeletonForm } from '@/components/ui/skeleton';

export default function AdminSettingsS3Page() {
  const queryClient = useQueryClient();
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const t = useTranslations('settings');

  const { data: s3Config, isLoading } = useQuery({
    queryKey: ['admin', 'settings', 's3'],
    queryFn: adminSettingsAPI.getS3Config,
  });

  // Initialize form with defaults or s3Config data
  const [formData, setFormData] = useState<S3ConfigRequest>({
    endpoint: '',
    access_key: '',
    secret_key: '',
    bucket: '',
    region: 'us-east-1',
    ttl_days: 7,
  });

  // Track the previous s3Config ID to detect when it changes
  const prevS3ConfigIdRef = useRef<string | null>(null);

  // Update form when s3Config changes (using effect with proper dependency)
  useEffect(() => {
    // Create a unique ID for the config to track changes
    const configId = s3Config ? JSON.stringify(s3Config) : null;

    if (s3Config && configId !== prevS3ConfigIdRef.current) {
      prevS3ConfigIdRef.current = configId;
      // Schedule state update for next render
      queueMicrotask(() => {
        setFormData({
          endpoint: s3Config.endpoint,
          access_key: s3Config.access_key,
          secret_key: '', // Don't populate secret key for security
          bucket: s3Config.bucket,
          region: s3Config.region,
          ttl_days: s3Config.ttl_days,
        });
      });
    }
  }, [s3Config]);

  const updateMutation = useMutation({
    mutationFn: adminSettingsAPI.updateS3Config,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 's3'] });
      alert('S3 configuration updated successfully');
    },
    onError: (error: Error) => {
      alert(`Failed to update S3 configuration: ${error.message}`);
    },
  });

  const testMutation = useMutation({
    mutationFn: adminSettingsAPI.testS3Connection,
    onSuccess: (data) => {
      setTestResult(data);
    },
    onError: (error: Error) => {
      setTestResult({ success: false, message: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.access_key || !formData.secret_key) {
      alert('Access key and secret key are required');
      return;
    }
    updateMutation.mutate(formData);
  };

  const handleTest = () => {
    if (!formData.access_key || !formData.secret_key) {
      alert('Access key and secret key are required');
      return;
    }
    setTestResult(null);
    testMutation.mutate(formData);
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">{t('s3Config')}</h1>

      {isLoading ? (
        <SkeletonForm fields={6} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6 bg-card border border-border rounded-lg p-6">
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('s3Endpoint')}
                <span className="text-muted-foreground font-normal ml-2">{t('s3EndpointDescription')}</span>
              </label>
              <input
                type="text"
                className="w-full border-input bg-background border rounded px-3 py-2"
                value={formData.endpoint}
                onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                placeholder={t('endpointPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                {t('accessKey')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full border-input bg-background border rounded px-3 py-2"
                value={formData.access_key}
                onChange={(e) => setFormData({ ...formData, access_key: e.target.value })}
                placeholder={t('accessKeyPlaceholder')}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                {t('secretKey')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showSecretKey ? 'text' : 'password'}
                  className="w-full border-input bg-background border rounded px-3 py-2 pr-20"
                  value={formData.secret_key}
                  onChange={(e) => setFormData({ ...formData, secret_key: e.target.value })}
                  placeholder={t('secretKeyPlaceholder')}
                  required
                />
                <button
                  type="button"
                  className="absolute right-2 top-2 text-sm text-primary hover:text-primary/80"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                >
                  {showSecretKey ? t('hide') : t('show')}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                {t('bucketName')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full border-input bg-background border rounded px-3 py-2"
                value={formData.bucket}
                onChange={(e) => setFormData({ ...formData, bucket: e.target.value })}
                placeholder={t('bucketPlaceholder')}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{t('region')}</label>
              <input
                type="text"
                className="w-full border-input bg-background border rounded px-3 py-2"
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                placeholder={t('regionPlaceholder')}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('regionDescription')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                {t('fileTTL')}
              </label>
              <input
                type="number"
                className="w-full border-input bg-background border rounded px-3 py-2"
                value={formData.ttl_days}
                onChange={(e) => setFormData({ ...formData, ttl_days: parseInt(e.target.value) })}
                min="1"
                max="365"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('ttlDescription')}
              </p>
            </div>

            {testResult && (
              <div className={`p-4 rounded border ${testResult.success ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'}`}>
                <p className="font-medium">{testResult.success ? t('success') : t('failed')}</p>
                <p className="text-sm mt-1">{testResult.message}</p>
              </div>
            )}

            <div className="flex space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleTest}
                disabled={testMutation.isPending}
              >
                {testMutation.isPending ? t('testing') : t('testConnection')}
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? t('saving') : t('saveConfiguration')}
              </Button>
            </div>
          </form>
      )}
    </div>
  );
}

