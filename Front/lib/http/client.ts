const CLIENT_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api';

async function request<T>(path: string, init: RequestInit = {}) {
  const url = path.startsWith('http') ? path : `${CLIENT_API_BASE_URL}${path}`;
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload.message ?? payload.detail ?? response.statusText;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export const clientApi = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined
    }),
  delete: <T>(path: string) =>
    request<T>(path, {
      method: 'DELETE'
    })
};
