import SwrPosts from '../../components/swr-posts';
import { fetchPosts } from '../../lib/posts';
import { requestOrigin } from '../../lib/request-origin';

export default async function SwrPage() {
  const origin = await requestOrigin();
  const data = await fetchPosts(`${origin}/api/posts?source=swr-fallback`);
  return (
    <>
      <h1>SWR: server fallback data</h1>
      <SwrPosts fallback={{ '/api/posts?source=swr-fallback': data }} />
    </>
  );
}
