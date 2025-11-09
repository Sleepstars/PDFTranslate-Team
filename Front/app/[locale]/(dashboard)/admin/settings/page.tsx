'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminSettingsAPI, S3ConfigRequest } from '@/lib/api/admin-settings';
import { Button } from '@/components/ui/button';

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showSecretKey, setShowSecretKey] = useState(false);

  const { data: s3Config, isLoading } = useQuery({
    queryKey: ['admin', 'settings', 's3'],
    queryFn: adminSettingsAPI.getS3Config,
  });

  const [formData, setFormData] = useState<S3ConfigRequest>({
    endpoint: '',
    access_key: '',
    secret_key: '',
    bucket: '',
    region: 'us-east-1',
    ttl_days: 7,
  });

  // Update form when data loads
  useState(() => {
    if (s3Config) {
      setFormData({
        endpoint: s3Config.endpoint,
        access_key: s3Config.access_key,
        secret_key: '', // Don't populate secret key for security
        bucket: s3Config.bucket,
        region: s3Config.region,
        ttl_days: s3Config.ttl_days,
      });
    }
  });

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

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">System Settings</h1>

      <div className="bg-card border border-border rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">S3 Storage Configuration</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              S3 Endpoint
              <span className="text-muted-foreground font-normal ml-2">(Optional, leave empty for AWS S3)</span>
            </label>
            <input
              type="text"
              className="w-full border-input bg-background border rounded px-3 py-2"
              value={formData.endpoint}
              onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
              placeholder="https://s3.amazonaws.com or custom endpoint"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Access Key <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full border-input bg-background border rounded px-3 py-2"
              value={formData.access_key}
              onChange={(e) => setFormData({ ...formData, access_key: e.target.value })}
              placeholder="AWS Access Key ID"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Secret Key <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showSecretKey ? 'text' : 'password'}
                className="w-full border-input bg-background border rounded px-3 py-2 pr-20"
                value={formData.secret_key}
                onChange={(e) => setFormData({ ...formData, secret_key: e.target.value })}
                placeholder="AWS Secret Access Key"
                required
              />
              <button
                type="button"
                className="absolute right-2 top-2 text-sm text-blue-600 hover:text-blue-800"
                onClick={() => setShowSecretKey(!showSecretKey)}
              >
                {showSecretKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Bucket Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full border-input bg-background border rounded px-3 py-2"
              value={formData.bucket}
              onChange={(e) => setFormData({ ...formData, bucket: e.target.value })}
              placeholder="my-bucket"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Region</label>
            <input
              type="text"
              className="w-full border-input bg-background border rounded px-3 py-2"
              value={formData.region}
              onChange={(e) => setFormData({ ...formData, region: e.target.value })}
              placeholder="us-east-1"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              AWS region (e.g., us-east-1, eu-west-1, ap-northeast-1) or custom region for S3-compatible services
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              File TTL (Days)
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
              Files will be automatically deleted after this many days (1-365)
            </p>
          </div>

          {testResult && (
            <div className={`p-4 rounded border ${testResult.success ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'}`}>
              <p className="font-medium">{testResult.success ? '✓ Success' : '✗ Failed'}</p>
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
              {testMutation.isPending ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
