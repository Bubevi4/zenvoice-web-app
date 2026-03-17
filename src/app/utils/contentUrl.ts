/**
 * Переписывает URL хранилища MinIO (порт 9000) в same-origin путь /minio/...,
 * чтобы на HTTPS-странице запросы шли через прокси (Vite/Nginx), без Mixed Content
 * и без требования HTTPS на самом MinIO (у MinIO TLS на :9000 ненадёжен).
 */

export function toSecureContentUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return url ?? '';
  if (typeof window === 'undefined') return url;
  if (window.location.protocol !== 'https:') return url;
  try {
    const u = new URL(url);
    // И http, и https на порту 9000 ведём через прокси /minio
    if (u.port === '9000') {
      return window.location.origin + '/minio' + u.pathname + u.search;
    }
  } catch {
    // invalid URL
  }
  return url;
}
