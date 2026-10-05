import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import Link from 'next/link';
export const getStaticProps: GetStaticProps<{ builtAt: string }> = async () => ({
  props: { builtAt: new Date().toISOString() },
});
export default function Static({ builtAt }: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <main>
      <h1>Pages Router: getStaticProps</h1>
      <p>Built at: {builtAt}</p>
      <Link href="/legacy">Visit server page</Link>
      <p>
        <Link href="/">Demo home</Link>
      </p>
    </main>
  );
}
