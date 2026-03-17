/**
 * Переписывает HTTP-URL хранилища (MinIO на порту 9000) в same-origin путь /minio/...,
 * чтобы на HTTPS-странице не было Mixed Content (браузер блокирует http:// при https://).
 */

export function toSecureContentUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return url ?? '';
  if (typeof window === 'undefined') return url;
  if (window.location.protocol !== 'https:') return url;
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' && u.port === '9000') {
      return window.location.origin + '/minio' + u.pathname + u.search;
    }
  } catch {
    // invalid URL
  }
  return url;
}
