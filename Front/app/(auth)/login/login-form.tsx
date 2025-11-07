'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientApi } from '@/lib/http/client';

const initialState = { email: '', password: '' };

export function LoginForm() {
  const [form, setForm] = useState(initialState);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await clientApi.post('/auth/login', form);
      setForm(initialState);
      router.replace('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>邮箱</span>
        <input
          type="email"
          required
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          placeholder="admin@example.com"
        />
      </label>
      <label className="field">
        <span>密码</span>
        <input
          type="password"
          required
          value={form.password}
          onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          placeholder="••••••••"
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? '登录中...' : '登录'}
      </button>
    </form>
  );
}
