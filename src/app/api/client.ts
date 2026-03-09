/**
 * HTTP-клиент для вызовов API через Gateway.
 * Добавляет Bearer token и базовый URL.
 */

export const getBaseUrl = (): string => {
  const url = import.meta.env.VITE_API_URL;
  if (url !== undefined && url !== null) return String(url).replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    const p = port && port !== '80' && port !== '443' ? `:${port}` : '';
    return `${protocol}//${hostname}${p}`;
  }
  return 'http://localhost';
};

let getAccessToken: (() => string | null) | null = null;

export function setTokenGetter(fn: () => string | null): void {
  getAccessToken = fn;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T; ok: boolean; status: number }> {
  const base = getBaseUrl();
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  const token = getAccessToken?.() ?? null;
  const headers: HeadersInit = {
    ...(options.headers as Record<string, string>),
  };
  // Для FormData пусть заголовок Content-Type выставляет браузер (multipart boundary).
  if (!(options.body instanceof FormData)) {
    (headers as Record<string, string>)['Content-Type'] =
      (headers as Record<string, string>)['Content-Type'] ?? 'application/json';
  }
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    throw new ApiError(0, { detail: `Сеть: ${message}` });
  }
  let data: T;
  const ct = res.headers.get('Content-Type');
  if (ct?.includes('application/json')) {
    try {
      data = (await res.json()) as T;
    } catch {
      data = undefined as T;
    }
  } else {
    data = undefined as T;
  }
  return { data, ok: res.ok, status: res.status };
}

export async function apiGet<T>(path: string): Promise<T> {
  const { data, ok, status } = await apiFetch<T>(path, { method: 'GET' });
  if (!ok) throw new ApiError(status, data);
  return data;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const { data, ok, status } = await apiFetch<T>(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!ok) throw new ApiError(status, data);
  return data;
}

export async function apiPostForm<T>(path: string, formData: FormData): Promise<T> {
  const { data, ok, status } = await apiFetch<T>(path, {
    method: 'POST',
    body: formData,
  });
  if (!ok) throw new ApiError(status, data);
  return data;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const { data, ok, status } = await apiFetch<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!ok) throw new ApiError(status, data);
  return data;
}

export async function apiDelete(path: string): Promise<void> {
  const { ok, status, data } = await apiFetch<unknown>(path, { method: 'DELETE' });
  if (!ok && status !== 204) throw new ApiError(status, data);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body?: unknown
  ) {
    super(typeof body === 'object' && body !== null && 'detail' in body
      ? String((body as { detail?: unknown }).detail)
      : `API error ${status}`);
    this.name = 'ApiError';
  }
}
