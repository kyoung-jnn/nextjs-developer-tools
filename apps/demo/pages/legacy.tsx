import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import Link from 'next/link';
export const getServerSideProps: GetServerSideProps<{
  time: string;
  query: Record<string, string | string[] | undefined>;
}> = async (context) => ({ props: { time: new Date().toISOString(), query: context.query } });
export default function Legacy({
  time,
  query,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <main>
      <h1>Pages Router: getServerSideProps</h1>
      <p>Request time: {time}</p>
      <pre>{JSON.stringify(query, null, 2)}</pre>
      <Link href="/static">Visit static page</Link>
      <p>
        <Link href="/">Demo home</Link>
      </p>
    </main>
  );
}
