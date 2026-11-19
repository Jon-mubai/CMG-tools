/**
 * 统一接口层（阶段 0）。
 * 约定与现有前端一致：走 /api 代理到 Nest（:3001），不在本地存储业务数据。
 */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type RequestOpts = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export async function apiRequest<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    let msg = res.statusText || '请求失败';
    try {
      const data = await res.json();
      msg = data.message || data.error || msg;
    } catch {
      /* ignore */
    }
    if (res.status === 401) onUnauthorized?.();
    throw new ApiError(msg, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, token?: string | null) => apiRequest<T>(path, { token }),
  post: <T>(path: string, body: unknown, token?: string | null) =>
    apiRequest<T>(path, { method: 'POST', body, token }),
  put: <T>(path: string, body: unknown, token?: string | null) =>
    apiRequest<T>(path, { method: 'PUT', body, token }),
};
