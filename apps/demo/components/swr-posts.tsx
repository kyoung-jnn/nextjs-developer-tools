'use client';

import useSWR, { SWRConfig } from 'swr';
import { fetchPosts, type PostsData } from '../lib/posts';

function Posts() {
  const { data } = useSWR<PostsData>('/api/posts?source=swr-fallback', fetchPosts, {
    revalidateOnMount: false,
    revalidateOnFocus: false,
  });
  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}

export default function SwrPosts({ fallback }: { fallback: Record<string, PostsData> }) {
  return (
    <SWRConfig value={{ fallback }}>
      <Posts />
    </SWRConfig>
  );
}
