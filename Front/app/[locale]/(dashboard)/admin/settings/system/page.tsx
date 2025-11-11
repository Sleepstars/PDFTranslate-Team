'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminSettingsAPI } from '@/lib/api/admin-settings';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SkeletonForm } from '@/components/ui/skeleton';
import { EmailSuffixInput } from '@/components/ui/email-suffix-input';

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
          <div>
            <h2 className="text-lg font-semibold mb-1">{t('allowedEmailSuffixes')}</h2>
            <p className="text-sm text-muted-foreground">{t('allowedEmailSuffixesDescription')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t('emailSuffixInputLabel')}</label>
            <EmailSuffixInput
              value={allowedEmailSuffixes}
              onChange={setAllowedEmailSuffixes}
              placeholder="example.com"
              className="max-w-md"
            />
          </div>

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

