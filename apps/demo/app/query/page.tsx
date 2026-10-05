import {
  defaultShouldDehydrateQuery,
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { Suspense } from 'react';
import QueryPosts from '../../components/query-posts';
import QueryProvider from '../../components/query-provider';
import { fetchPosts } from '../../lib/posts';
import { requestOrigin } from '../../lib/request-origin';

export default async function QueryPage() {
  const origin = await requestOrigin();
  const client = new QueryClient();
  await client.fetchQuery({
    queryKey: ['posts', 'resolved'],
    queryFn: () => fetchPosts(`${origin}/api/posts?source=query-resolved`),
  });
  void client.prefetchQuery({
    queryKey: ['posts', 'streamed'],
    queryFn: () => fetchPosts(`${origin}/api/posts?source=query-streamed&delay=1200`),
  });
  const state = dehydrate(client, {
    shouldDehydrateQuery: (query) =>
      defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
    shouldRedactErrors: () => false,
  });
  return (
    <>
      <h1>TanStack Query: resolved and streamed server data</h1>
      <QueryProvider>
        <HydrationBoundary state={state}>
          <Suspense fallback={<p>Loading resolved query…</p>}>
            <QueryPosts variant="resolved" />
          </Suspense>
          <Suspense fallback={<p>Streaming pending query…</p>}>
            <QueryPosts variant="streamed" />
          </Suspense>
        </HydrationBoundary>
      </QueryProvider>
    </>
  );
}
