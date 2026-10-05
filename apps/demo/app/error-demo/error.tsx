'use client';
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section>
      <h1>Server error captured</h1>
      <p>{error.message}</p>
      {error.digest && <p>Digest: {error.digest}</p>}
      <button type="button" onClick={reset}>
        Retry
      </button>
    </section>
  );
}
