import { User } from '../types/user';

export interface AltchaChallenge {
  algorithm: string;
  challenge: string;
  salt: string;
  signature: string;
  maxnumber: number;
  expires: number;
}

export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
  altchaPayload?: string;
}

export async function login(email: string, password: string, altchaPayload?: string): Promise<User> {
  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, altchaPayload }),
    credentials: 'include',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Login failed' }));
    throw new Error(error.detail || 'Login failed');
  }
  const data = await res.json();
  return data.user;
}

export async function register(data: RegisterRequest): Promise<User> {
  const res = await fetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Registration failed' }));
    throw new Error(error.detail || 'Registration failed');
  }
  const result = await res.json();
  return result.user;
}

export async function getAltchaChallenge(): Promise<AltchaChallenge> {
  const res = await fetch('/auth/altcha/challenge', {
    credentials: 'include',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to get challenge' }));
    throw new Error(error.detail || 'Failed to get challenge');
  }
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch('/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
}

export async function getCurrentUser(): Promise<User | null> {
  const res = await fetch('/auth/me', { credentials: 'include' });
  if (!res.ok) return null;
  const data = await res.json();
  return data.user;
}

export async function requestPasswordReset(email: string, altchaPayload?: string): Promise<void> {
  const res = await fetch('/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, altchaPayload }),
    credentials: 'include',
  });
  if (!res.ok) {
    // still treat as success to avoid enumeration
    await res.text().catch(() => {});
  }
}

export async function resetPassword(token: string, newPassword: string, altchaPayload?: string): Promise<void> {
  const res = await fetch('/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword, altchaPayload }),
    credentials: 'include',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Reset failed' }));
    throw new Error(error.detail || 'Reset failed');
  }
}
