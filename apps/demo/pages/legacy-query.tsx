import {
  type DehydratedState,
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import QueryPosts from '../components/query-posts';
import QueryProvider from '../components/query-provider';
import { fetchPosts } from '../lib/posts';

export const getServerSideProps: GetServerSideProps<{ dehydratedState: DehydratedState }> = async ({
  req,
}) => {
  const host = req.headers['x-forwarded-host'] ?? req.headers.host;
  const forwardedProtocol = req.headers['x-forwarded-proto'];
  const protocol =
    (Array.isArray(forwardedProtocol) ? forwardedProtocol[0] : forwardedProtocol)
      ?.split(',')[0]
      ?.trim() ?? 'http';
  if (!host) throw new Error('Request host is required for the local posts API');
  const client = new QueryClient();
  await client.fetchQuery({
    queryKey: ['posts', 'legacy'],
    queryFn: () => fetchPosts(`${protocol}://${host}/api/posts?source=query-legacy`),
  });
  return { props: { dehydratedState: dehydrate(client) } };
};

export default function LegacyQuery({
  dehydratedState,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <main>
      <h1>Pages Router: dehydratedState</h1>
      <QueryProvider>
        <HydrationBoundary state={dehydratedState}>
          <Suspense fallback={<p>Loading query…</p>}>
            <QueryPosts variant="legacy" />
          </Suspense>
        </HydrationBoundary>
      </QueryProvider>
      <Link href="/">Demo home</Link>
    </main>
  );
}
