'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { getAltchaChallenge } from '@/lib/api/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [altchaPayload, setAltchaPayload] = useState<string | undefined>();
  const [altchaEnabled, setAltchaEnabled] = useState(false);
  const [challengeUrl, setChallengeUrl] = useState('');
  const [error, setError] = useState('');
  const { login, isLoggingIn } = useAuth();
  const t = useTranslations('login');

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (altchaEnabled && !altchaPayload) {
      setError(t('altchaRequired'));
      return;
    }
    login({ email, password, altchaPayload });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg shadow border">
        <h1 className="text-2xl font-bold text-center text-foreground">{t('title')}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">{t('email')}</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">{t('password')}</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          {altchaEnabled && challengeUrl && (
            <div className="flex justify-center">
              <altcha-widget
                challengeurl={challengeUrl}
                auto="onsubmit"
                hidefooter
                style={{
                  ['--altcha-max-width' as any]: '520px',
                  ['--altcha-border-width' as any]: '2px',
                  ['--altcha-border-radius' as any]: '12px',
                  ['--altcha-color-base' as any]: 'hsl(var(--card))',
                  ['--altcha-color-text' as any]: 'hsl(var(--foreground))',
                  ['--altcha-color-border' as any]: 'hsl(var(--border))',
                  ['--altcha-color-border-focus' as any]: 'hsl(var(--primary))',
                  transform: 'scale(1.15)',
                  transformOrigin: 'center',
                } as any}
              />
            </div>
          )}

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">{error}</div>
          )}

          <Button type="submit" className="w-full" disabled={isLoggingIn}>
            {isLoggingIn ? t('loggingIn') : t('login')}
          </Button>
        </form>

        <div className="flex items-center justify-between text-sm">
          <Link href="/forgot-password" className="text-primary hover:underline">
            {t('forgotPassword')}
          </Link>
          <div>
            <span className="text-muted-foreground">{t('noAccount')} </span>
            <Link href="/register" className="text-primary hover:underline">
              {t('registerHere')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
