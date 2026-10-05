'use client';

import { use } from 'react';
import type { PostsData } from '../lib/posts';

export function FetchProps({ posts }: { posts: PostsData }) {
  return (
    <section>
      <h2>JSON passed as props</h2>
      <pre>{JSON.stringify(posts, null, 2)}</pre>
    </section>
  );
}

export function FetchPromise({ postsPromise }: { postsPromise: Promise<PostsData> }) {
  const posts = use(postsPromise);
  return (
    <section>
      <h2>Promise read with use()</h2>
      <pre>{JSON.stringify(posts, null, 2)}</pre>
    </section>
  );
}
