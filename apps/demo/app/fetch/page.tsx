import { Suspense } from 'react';
import { FetchPromise, FetchProps } from '../../components/fetch-posts';
import type { PostsData } from '../../lib/posts';
import { requestOrigin } from '../../lib/request-origin';

async function PromisePosts(origin: string): Promise<PostsData> {
  const response = await fetch(`${origin}/api/posts?source=fetch-promise&delay=1200`, {
    cache: 'no-store',
  });
  const data: PostsData = await response.json();
  return data;
}

async function RenderOnlyPosts({ origin }: { origin: string }) {
  const response = await fetch(`${origin}/api/posts?source=fetch-render-only`, {
    cache: 'no-store',
  });
  const data: PostsData = await response.json();
  return (
    <section>
      <h2>Server rendering only</h2>
      <p>{data.posts.map((post) => post.title).join(' · ')}</p>
    </section>
  );
}

export default async function FetchPage() {
  const origin = await requestOrigin();
  const response = await fetch(`${origin}/api/posts?source=fetch-props`, { cache: 'no-store' });
  const posts: PostsData = await response.json();
  const postsPromise = PromisePosts(origin);
  return (
    <>
      <h1>Plain server fetch: props, promises, and rendering</h1>
      <FetchProps posts={posts} />
      <Suspense fallback={<p>Streaming fetch promise…</p>}>
        <FetchPromise postsPromise={postsPromise} />
      </Suspense>
      <Suspense fallback={<p>Fetching server rendering data…</p>}>
        <RenderOnlyPosts origin={origin} />
      </Suspense>
    </>
  );
}
