import type { Metadata } from 'next';
import Link from 'next/link';

interface Props {
  params: Promise<{ slug: string }>;
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Blog: ${slug}` };
}
export default async function Blog({ params }: Props) {
  const { slug } = await params;
  return (
    <>
      <h1>Blog: {slug}</h1>
      <p>Dynamic route payload and prefetch example.</p>
      <Link href={slug === 'hello' ? '/blog/world' : '/blog/hello'}>Visit another post</Link>
    </>
  );
}
