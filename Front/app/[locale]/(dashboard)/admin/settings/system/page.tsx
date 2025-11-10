'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminSettingsAPI } from '@/lib/api/admin-settings';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SkeletonForm } from '@/components/ui/skeleton';

const COMMON_EMAIL_SUFFIXES = [
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'qq.com',
  '163.com',
  '126.com',
  'sina.com',
  'foxmail.com',
];

export default function AdminSettingsSystemPage() {
  const t = useTranslations('settings');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'settings', 'system'],
    queryFn: adminSettingsAPI.getSystem,
  });

  // Derive state from data using useMemo to avoid setState in effects
  const derivedState = useMemo(() => ({
    allowRegistration: data?.allowRegistration ?? false,
    altchaEnabled: data?.altchaEnabled ?? false,
    altchaSecretKey: data?.altchaSecretKey ?? '',
    allowedEmailSuffixes: data?.allowedEmailSuffixes ?? [],
  }), [data]);

  // Local state for form inputs
  const [allowRegistration, setAllowRegistration] = useState(derivedState.allowRegistration);
  const [altchaEnabled, setAltchaEnabled] = useState(derivedState.altchaEnabled);
  const [altchaSecretKey, setAltchaSecretKey] = useState(derivedState.altchaSecretKey);
  const [allowedEmailSuffixes, setAllowedEmailSuffixes] = useState(derivedState.allowedEmailSuffixes);
  const [customSuffix, setCustomSuffix] = useState('');

  // Update state when derived state changes
  useEffect(() => {
    setAllowRegistration(derivedState.allowRegistration);
    setAltchaEnabled(derivedState.altchaEnabled);
    setAltchaSecretKey(derivedState.altchaSecretKey);
    setAllowedEmailSuffixes(derivedState.allowedEmailSuffixes);
  }, [derivedState]);

  const updateMutation = useMutation({
    mutationFn: adminSettingsAPI.updateSystem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 'system'] });
      alert('Updated');
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      allowRegistration,
      altchaEnabled,
      altchaSecretKey: altchaSecretKey || undefined,
      allowedEmailSuffixes,
    });
  };

  const toggleEmailSuffix = (suffix: string) => {
    setAllowedEmailSuffixes((prev) =>
      prev.includes(suffix)
        ? prev.filter((s) => s !== suffix)
        : [...prev, suffix]
    );
  };

  const addCustomSuffix = () => {
    const trimmed = customSuffix.trim();
    if (trimmed && !allowedEmailSuffixes.includes(trimmed)) {
      setAllowedEmailSuffixes((prev) => [...prev, trimmed]);
      setCustomSuffix('');
    }
  };

  const removeCustomSuffix = (suffix: string) => {
    setAllowedEmailSuffixes((prev) => prev.filter((s) => s !== suffix));
  };

  if (isLoading) return <SkeletonForm fields={5} />;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">{t('systemConfig')}</h1>
      <form onSubmit={handleSubmit} className="space-y-6 bg-card border border-border rounded-lg p-6">
        {/* Allow Registration */}
        <div className="flex items-start gap-3">
          <input
            id="allowRegistration"
            type="checkbox"
            checked={allowRegistration}
            onChange={(e) => setAllowRegistration(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-input"
          />
          <div>
            <label htmlFor="allowRegistration" className="block text-sm font-medium mb-1">
              {t('allowRegistration')}
            </label>
            <p className="text-xs text-muted-foreground">{t('allowRegistrationDescription')}</p>
          </div>
        </div>

        {/* ALTCHA Configuration */}
        <div className="space-y-4 pt-4 border-t">
          <h2 className="text-lg font-semibold">ALTCHA {t('configuration')}</h2>

          <div className="flex items-start gap-3">
            <input
              id="altchaEnabled"
              type="checkbox"
              checked={altchaEnabled}
              onChange={(e) => setAltchaEnabled(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-input"
            />
            <div>
              <label htmlFor="altchaEnabled" className="block text-sm font-medium mb-1">
                {t('enableAltcha')}
              </label>
              <p className="text-xs text-muted-foreground">{t('enableAltchaDescription')}</p>
            </div>
          </div>

          {altchaEnabled && (
            <div>
              <label htmlFor="altchaSecretKey" className="block text-sm font-medium mb-2">
                {t('altchaSecretKey')}
              </label>
              <Input
                id="altchaSecretKey"
                type="password"
                value={altchaSecretKey}
                onChange={(e) => setAltchaSecretKey(e.target.value)}
                placeholder={t('altchaSecretKeyPlaceholder')}
                className="max-w-md"
              />
              <p className="text-xs text-muted-foreground mt-1">{t('altchaSecretKeyDescription')}</p>
            </div>
          )}
        </div>

        {/* Allowed Email Suffixes */}
        <div className="space-y-4 pt-4 border-t">
          <h2 className="text-lg font-semibold">{t('allowedEmailSuffixes')}</h2>
          <p className="text-sm text-muted-foreground">{t('allowedEmailSuffixesDescription')}</p>

          {/* Common suffixes */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('commonEmailProviders')}</label>
            <div className="flex flex-wrap gap-2">
              {COMMON_EMAIL_SUFFIXES.map((suffix) => (
                <button
                  key={suffix}
                  type="button"
                  onClick={() => toggleEmailSuffix(suffix)}
                  className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                    allowedEmailSuffixes.includes(suffix)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-input hover:bg-accent'
                  }`}
                >
                  {suffix}
                </button>
              ))}
            </div>
          </div>

          {/* Custom suffixes */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('customEmailSuffixes')}</label>
            <div className="flex gap-2 max-w-md">
              <Input
                type="text"
                value={customSuffix}
                onChange={(e) => setCustomSuffix(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomSuffix())}
                placeholder="example.com"
              />
              <Button type="button" onClick={addCustomSuffix} variant="outline">
                {t('add')}
              </Button>
            </div>
          </div>

          {/* Selected custom suffixes */}
          {allowedEmailSuffixes.filter((s) => !COMMON_EMAIL_SUFFIXES.includes(s)).length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">{t('selectedCustomSuffixes')}</label>
              <div className="flex flex-wrap gap-2">
                {allowedEmailSuffixes
                  .filter((s) => !COMMON_EMAIL_SUFFIXES.includes(s))
                  .map((suffix) => (
                    <div
                      key={suffix}
                      className="flex items-center gap-1 px-3 py-1 text-sm rounded-md bg-secondary border border-border"
                    >
                      <span>{suffix}</span>
                      <button
                        type="button"
                        onClick={() => removeCustomSuffix(suffix)}
                        className="ml-1 text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {allowedEmailSuffixes.length === 0 && (
            <p className="text-sm text-muted-foreground italic">{t('noEmailSuffixRestriction')}</p>
          )}
        </div>

        <div className="pt-4">
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? t('saving') : t('saveConfiguration')}
          </Button>
        </div>
      </form>
    </div>
  );
}

