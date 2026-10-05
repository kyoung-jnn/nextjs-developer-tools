'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { fetchPosts } from '../lib/posts';

export default function QueryPosts({ variant }: { variant: 'resolved' | 'streamed' | 'legacy' }) {
  const { data } = useSuspenseQuery({
    queryKey: ['posts', variant],
    queryFn: () => fetchPosts(`/api/posts?source=query-${variant}`),
    staleTime: 60_000,
  });
  return (
    <section>
      <h2>{variant} query</h2>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </section>
  );
}
