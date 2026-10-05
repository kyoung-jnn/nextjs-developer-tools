import type { HookEvent } from './messages';
import type { Detection } from './types';
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function isDetection(value: unknown): value is Detection {
  return (
    isObject(value) &&
    typeof value.isNext === 'boolean' &&
    (value.router === null || ['app', 'pages', 'unknown'].includes(String(value.router))) &&
    Array.isArray(value.signals) &&
    value.signals.every((signal) => typeof signal === 'string') &&
    (value.version === undefined || typeof value.version === 'string') &&
    (value.buildId === undefined || typeof value.buildId === 'string') &&
    (value.mode === undefined || value.mode === 'development' || value.mode === 'production')
  );
}
function headers(value: unknown): boolean {
  return isObject(value) && Object.values(value).every((header) => typeof header === 'string');
}
export function isHookEvent(value: unknown): value is HookEvent {
  if (!isObject(value)) return false;
  switch (value.type) {
    case 'debug-chunk':
      return (
        typeof value.requestId === 'string' &&
        (value.chunk === null || value.chunk instanceof Uint8Array)
      );
    case 'detect':
      return isDetection(value.detection);
    case 'record-start': {
      const record = value.record;
      return (
        isObject(record) &&
        typeof record.id === 'string' &&
        [
          'document',
          'navigation',
          'prefetch',
          'action',
          'rsc',
          'pages-document',
          'pages-data',
        ].includes(String(record.kind)) &&
        typeof record.url === 'string' &&
        typeof record.method === 'string' &&
        typeof record.startTime === 'number' &&
        (record.requestId === undefined || typeof record.requestId === 'string') &&
        headers(record.requestHeaders) &&
        headers(record.responseHeaders)
      );
    }
    case 'record-chunk':
      return typeof value.id === 'string' && value.chunk instanceof Uint8Array;
    case 'record-meta':
      return (
        typeof value.id === 'string' &&
        isObject(value.patch) &&
        (value.patch.requestId === undefined || typeof value.patch.requestId === 'string') &&
        (value.patch.status === undefined || typeof value.patch.status === 'number') &&
        (value.patch.responseHeaders === undefined || headers(value.patch.responseHeaders)) &&
        (value.patch.requestHeaders === undefined || headers(value.patch.requestHeaders)) &&
        (value.patch.done === undefined || typeof value.patch.done === 'boolean') &&
        (value.patch.endTime === undefined || typeof value.patch.endTime === 'number') &&
        (value.patch.error === undefined || typeof value.patch.error === 'string')
      );
    case 'record-end':
      return (
        typeof value.id === 'string' &&
        typeof value.endTime === 'number' &&
        (value.error === undefined || typeof value.error === 'string')
      );
    default:
      return false;
  }
}
