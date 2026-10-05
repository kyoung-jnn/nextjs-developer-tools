import Link from 'next/link';
import Counter from './counter';
export default function Home() {
  return (
    <>
      <h1>SSR and Flight payloads</h1>
      <p>Open the Payload 🅝 DevTools panel to inspect these pages.</p>
      <ul>
        {[
          ['/streaming', 'Streaming and server logs'],
          ['/query', 'TanStack Query server data and streaming'],
          ['/swr', 'SWR server fallback data'],
          ['/fetch', 'Server fetch props, promises, and rendering'],
          ['/legacy-query', 'Pages TanStack Query dehydratedState'],
          ['/blog/hello', 'Dynamic blog route'],
          ['/action', 'Server action'],
          ['/error-demo', 'Server error'],
          ['/legacy', 'Pages getServerSideProps'],
          ['/static', 'Pages getStaticProps'],
        ].map(([href, label]) => (
          <li key={href}>
            <Link href={href ?? '/'}>{label}</Link>
          </li>
        ))}
      </ul>
      <Counter
        message="Hello 👋 — café data sent from the server"
        createdAt={new Date('2026-10-05T00:00:00Z')}
        details={{ user: { name: 'Next.js' }, tags: ['UTF-8', 'Flight'] }}
        items={[1, 2, 3]}
      />
    </>
  );
}
