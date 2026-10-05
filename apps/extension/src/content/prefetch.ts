import type { CaptureRecord } from '../shared/types';

export function isPrefetchRecord(record: Pick<CaptureRecord, 'kind' | 'requestHeaders'>): boolean {
  return record.kind === 'prefetch' || hasPrefetchHeaders(record.requestHeaders);
}

export function hasPrefetchHeaders(headers: Record<string, string>): boolean {
  return Object.entries(headers).some(([name, value]) => {
    const key = name.toLowerCase();
    return (
      key === 'next-router-prefetch' ||
      key === 'next-router-segment-prefetch' ||
      key === 'x-middleware-prefetch' ||
      ((key === 'purpose' || key === 'sec-purpose') && /\bprefetch\b/i.test(value))
    );
  });
}
