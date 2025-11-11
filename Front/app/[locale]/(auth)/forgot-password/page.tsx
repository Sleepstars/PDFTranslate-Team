'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import { getAltchaChallenge, requestPasswordReset } from '@/lib/api/auth';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const t = useTranslations('forgotPassword');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [altchaPayload, setAltchaPayload] = useState<string | undefined>();
  const [altchaEnabled, setAltchaEnabled] = useState(false);
  const [challengeUrl, setChallengeUrl] = useState('');

  useEffect(() => {
    const checkAltcha = async () => {
      try {
        await getAltchaChallenge();
        setAltchaEnabled(true);
        setChallengeUrl('/auth/altcha/challenge');
      } catch {
        setAltchaEnabled(false);
      }
    };
    checkAltcha();
  }, []);

  useEffect(() => {
    if (altchaEnabled && typeof window !== 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/altcha/dist/altcha.min.js';
      script.type = 'module';
      document.head.appendChild(script);
      return () => {
        document.head.removeChild(script);
      };
    }
  }, [altchaEnabled]);

  useEffect(() => {
    if (!altchaEnabled) return;
    const handleAltchaStateChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail.state === 'verified') {
        setAltchaPayload(customEvent.detail.payload);
      } else {
        setAltchaPayload(undefined);
      }
    };
    const widget = document.querySelector('altcha-widget');
    if (widget) {
      widget.addEventListener('statechange', handleAltchaStateChange);
      return () => {
        widget.removeEventListener('statechange', handleAltchaStateChange);
      };
    }
  }, [altchaEnabled]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (altchaEnabled && !altchaPayload) {
      setError(t('altchaRequired'));
      return;
    }
    try {
      await requestPasswordReset(email, altchaPayload);
      setSent(true);
    } catch {
      // Even on failure, we present as success to avoid enumeration; keep quiet
      setSent(true);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg shadow border">
        <h1 className="text-2xl font-bold text-center text-foreground">{t('title')}</h1>
        {sent ? (
          <div className="space-y-4 text-sm text-foreground">
            <p>{t('sent')}</p>
            <Link href="/login" className="text-primary hover:underline">{t('backToLogin')}</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">{t('email')}</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            {altchaEnabled && challengeUrl && (
              <div className="flex justify-center">
                <altcha-widget challengeurl={challengeUrl} auto="onsubmit" hidefooter />
              </div>
            )}

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">{error}</div>
            )}

            <Button type="submit" className="w-full">{t('sendLink')}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
