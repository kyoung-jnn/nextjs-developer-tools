import type { CaptureKind } from './types';
export interface ClassifyInput {
  url: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
}
export function classifyRequest(input: ClassifyInput): CaptureKind | null {
  const req = Object.fromEntries(
    Object.entries(input.requestHeaders).map(([k, v]) => [k.toLowerCase(), v]),
  );
  const res = Object.fromEntries(
    Object.entries(input.responseHeaders).map(([k, v]) => [k.toLowerCase(), v]),
  );
  const contentType = (res['content-type'] ?? '').toLowerCase();
  if (contentType.includes('text/x-component')) {
    if (req['next-action'] !== undefined) return 'action';
    if (
      req['next-router-prefetch'] !== undefined ||
      req['next-router-segment-prefetch'] !== undefined
    )
      return 'prefetch';
    if (req.rsc === '1') return 'navigation';
    return 'rsc';
  }
  try {
    if (
      new URL(input.url, 'https://next.invalid').pathname.startsWith('/_next/data/') &&
      contentType.includes('application/json')
    )
      return 'pages-data';
  } catch {
    return null;
  }
  return null;
}
