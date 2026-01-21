import { Suspense } from "react";

// Immediate data component (no delay)
function ImmediateData() {
  const timestamp = new Date().toISOString();

  return (
    <div className="rounded-lg bg-green-100 p-4 dark:bg-green-900">
      <h3 className="font-semibold text-green-800 dark:text-green-200">
        Immediate Data
      </h3>
      <div className="mt-2 space-y-1 text-green-700 dark:text-green-300">
        <p>
          <strong>Ready:</strong> Yes
        </p>
        <p>
          <strong>Timestamp:</strong> {timestamp}
        </p>
        <p className="text-sm">This content loaded immediately.</p>
      </div>
    </div>
  );
}

// Delayed data component with artificial delay
async function DelayedData() {
  // Simulate heavy computation or slow API
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return (
    <div className="rounded-lg bg-blue-100 p-4 dark:bg-blue-900">
      <h3 className="font-semibold text-blue-800 dark:text-blue-200">
        Delayed Data
      </h3>
      <div className="mt-2 space-y-1 text-blue-700 dark:text-blue-300">
        <p>
          <strong>Loaded:</strong> Yes
        </p>
        <p>
          <strong>Heavy Computation:</strong> Result after 2s delay
        </p>
        <p className="text-sm">This content was streamed after a delay.</p>
      </div>
    </div>
  );
}

// Loading fallback for delayed content
function LoadingFallback() {
  return (
    <div className="rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-950">
      <div className="flex items-center justify-center space-x-3">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        <span className="text-blue-600 dark:text-blue-400">
          Loading delayed content...
        </span>
      </div>
    </div>
  );
}

export default function StreamingPage() {
  return (
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-zinc-900">
      <main className="mx-auto max-w-4xl">
        <a
          href="/"
          className="mb-4 inline-block text-blue-600 hover:underline dark:text-blue-400"
        >
          &larr; Back to Home
        </a>

        <h1 className="mb-8 text-4xl font-bold text-zinc-900 dark:text-zinc-100">
          Streaming Page (Suspense)
        </h1>

        <div className="mb-6 rounded-lg bg-pink-100 p-4 dark:bg-pink-900">
          <h2 className="text-lg font-semibold text-pink-800 dark:text-pink-200">
            Streaming SSR Demo
          </h2>
          <p className="mt-1 text-pink-700 dark:text-pink-300">
            This page demonstrates React Suspense with streaming SSR. The
            immediate content appears first, while delayed content streams in
            after 2 seconds.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Immediate content - no suspense needed */}
          <ImmediateData />

          {/* Delayed content with Suspense boundary */}
          <Suspense fallback={<LoadingFallback />}>
            <DelayedData />
          </Suspense>
        </div>

        <div className="mt-6 rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
          <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">
            How it works
          </h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            <li>
              The page shell and immediate data are sent to the browser first
            </li>
            <li>A loading placeholder is shown for the delayed content</li>
            <li>
              After 2 seconds, the delayed content streams in and replaces the
              placeholder
            </li>
            <li>Check the DevTools Network tab to see the chunked response</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
