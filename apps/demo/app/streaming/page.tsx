import { Suspense } from 'react';
export const dynamic = 'force-dynamic';
async function Delayed() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  console.log('Streaming demo: delayed component ready');
  console.warn('Streaming demo: sample server warning');
  return <p>Delayed server content: café — 🚀</p>;
}
export default function Streaming() {
  return (
    <>
      <h1>Streaming</h1>
      <p>This content renders immediately.</p>
      <Suspense fallback={<p>Waiting one second…</p>}>
        <Delayed />
      </Suspense>
    </>
  );
}
