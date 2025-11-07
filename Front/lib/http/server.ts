import { cookies } from 'next/headers';

const SERVER_API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api';

async function request<T>(path: string, init: RequestInit = {}) {
  const url = path.startsWith('http') ? path : `${SERVER_API_BASE_URL}${path}`;
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map((entry) => `${entry.name}=${entry.value}`).join('; ');

  const headers = new Headers(init.headers);
  if (cookieHeader && !headers.has('cookie') && !headers.has('Cookie')) {
    headers.set('Cookie', cookieHeader);
  }
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload.message ?? payload.detail ?? response.statusText;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export const serverApi = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    })
};
