import type { NextRequest } from 'next/server';
import { makePosts } from '../../../lib/posts';

export async function GET(request: NextRequest) {
  const delay = Number(request.nextUrl.searchParams.get('delay') ?? 0);
  if (Number.isFinite(delay) && delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 2000)));
  }
  return Response.json(makePosts(request.nextUrl.searchParams.get('source') ?? 'posts'));
}
