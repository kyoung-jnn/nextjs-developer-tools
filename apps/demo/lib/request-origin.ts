import { headers } from 'next/headers';

export async function requestOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  if (!host) throw new Error('Request host is required for the local posts API');
  const protocol = requestHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? 'http';
  return `${protocol}://${host}`;
}
