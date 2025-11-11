'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import { register, getAltchaChallenge } from '@/lib/api/auth';
import { useAuth } from '@/lib/hooks/use-auth';
import Link from 'next/link';

export default function RegisterPage() {
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
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [altchaPayload, setAltchaPayload] = useState<string | undefined>();
  const [altchaEnabled, setAltchaEnabled] = useState(false);
  const [challengeUrl, setChallengeUrl] = useState('');

  const router = useRouter();
  const { refetch } = useAuth();
  const t = useTranslations('register');

  // Check if ALTCHA is enabled and get challenge URL
  useEffect(() => {
    const checkAltcha = async () => {
      try {
        await getAltchaChallenge();
        setAltchaEnabled(true);
        setChallengeUrl('/auth/altcha/challenge');
      } catch {
        // ALTCHA is not enabled or not configured
        setAltchaEnabled(false);
      }
    };
    checkAltcha();
  }, []);

  // Load ALTCHA widget script
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

  // Listen for ALTCHA state changes
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

    // Validation
    if (!name.trim()) {
      setError(t('nameRequired'));
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

    setIsRegistering(true);

    try {
      await register({
        email,
        name,
        password,
        altchaPayload,
      });

      // Refetch user data
      await refetch();

      // Redirect to dashboard
      router.push('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('registrationFailed'));
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg shadow border">
        <h1 className="text-2xl font-bold text-center text-foreground">{t('title')}</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">{t('email')}</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isRegistering}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">{t('name')}</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isRegistering}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">{t('password')}</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isRegistering}
              minLength={8}
            />
            <p className="text-xs text-muted-foreground mt-1">{t('passwordHint')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">{t('confirmPassword')}</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isRegistering}
              minLength={8}
            />
          </div>

          {altchaEnabled && challengeUrl && (
            <div className="flex justify-center">
              <altcha-widget challengeurl={challengeUrl} auto="onsubmit" hidefooter style={altchaStyle} />
            </div>
          )}

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isRegistering}>
            {isRegistering ? t('registering') : t('register')}
          </Button>
        </form>

        <div className="text-center text-sm">
          <span className="text-muted-foreground">{t('alreadyHaveAccount')} </span>
          <Link href="/login" className="text-primary hover:underline">
            {t('loginHere')}
          </Link>
        </div>
      </div>
    </div>
  );
}
