'use client';

import { Suspense, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import { getAltchaChallenge, resetPassword } from '@/lib/api/auth';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

function ResetPasswordContent() {
  const t = useTranslations('resetPassword');
  const sp = useSearchParams();
  const router = useRouter();
  const [token, setToken] = useState(() => sp.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [altchaPayload, setAltchaPayload] = useState<string | undefined>();
  const [altchaEnabled, setAltchaEnabled] = useState(false);
  const [challengeUrl, setChallengeUrl] = useState('');
  type AltchaInlineStyle = React.CSSProperties & {
    '--altcha-max-width'?: string;
    '--altcha-border-width'?: string;
    '--altcha-border-radius'?: string;
    '--altcha-color-base'?: string;
    '--altcha-color-text'?: string;
    '--altcha-color-border'?: string;
    '--altcha-color-border-focus'?: string;
  };
  const altchaStyle: AltchaInlineStyle = {
    '--altcha-max-width': '520px',
    '--altcha-border-width': '2px',
    '--altcha-border-radius': '12px',
    '--altcha-color-base': 'hsl(var(--card))',
    '--altcha-color-text': 'hsl(var(--foreground))',
    '--altcha-color-border': 'hsl(var(--border))',
    '--altcha-color-border-focus': 'hsl(var(--primary))',
    transform: 'scale(1.15)',
    transformOrigin: 'center',
  };

  // Derive initial token from URL once via lazy initializer above

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
    if (!token.trim()) {
      setError(t('tokenRequired'));
      return;
    }
    if (password.length < 8) {
      setError(t('passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }
    if (altchaEnabled && !altchaPayload) {
      setError(t('altchaRequired'));
      return;
    }
    try {
      await resetPassword(token, password, altchaPayload);
      setDone(true);
      // Optionally redirect after short delay
      setTimeout(() => router.push('/login'), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('resetFailed'));
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg shadow border">
        <h1 className="text-2xl font-bold text-center text-foreground">{t('title')}</h1>

        {done ? (
          <div className="space-y-4 text-sm text-foreground">
            <p>{t('done')}</p>
            <Link href="/login" className="text-primary hover:underline">{t('backToLogin')}</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!sp.get('token') && (
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">{t('token')}</label>
                <Input type="text" value={token} onChange={(e) => setToken(e.target.value)} required />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">{t('newPassword')}</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">{t('confirmPassword')}</label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
            </div>

            {altchaEnabled && challengeUrl && (
              <div className="flex justify-center">
                <altcha-widget challengeurl={challengeUrl} auto="onsubmit" hidefooter style={altchaStyle} />
              </div>
            )}

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">{error}</div>
            )}

            <Button type="submit" className="w-full">{t('reset')}</Button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-foreground">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
