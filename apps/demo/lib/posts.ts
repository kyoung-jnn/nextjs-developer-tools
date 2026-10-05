export interface PostsData {
  source: string;
  message: string;
  posts: { id: number; title: string; author: { name: string }; tags: string[] }[];
}

export function makePosts(source = 'posts'): PostsData {
  return {
    source,
    message: 'Hello 👋 — café',
    posts: [
      {
        id: 1,
        title: 'Server data at the café ☕',
        author: { name: 'Zoë' },
        tags: ['SSR', 'UTF-8'],
      },
      {
        id: 2,
        title: 'Streaming promises 👋',
        author: { name: 'Renée' },
        tags: ['Flight', 'streaming'],
      },
    ],
  };
}

export async function fetchPosts(url: string): Promise<PostsData> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Posts request failed: ${response.status}`);
  const data: PostsData = await response.json();
  return data;
}
