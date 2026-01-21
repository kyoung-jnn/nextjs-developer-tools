import { GetStaticProps } from "next";

interface ISRPageProps {
  generatedAt: string;
  data: {
    randomValue: number;
    message: string;
  };
}

export const getStaticProps: GetStaticProps<ISRPageProps> = async () => {
  return {
    props: {
      generatedAt: new Date().toISOString(),
      data: {
        randomValue: Math.random(),
        message: "This page is regenerated every 60 seconds (ISR)",
      },
    },
    revalidate: 60, // Regenerate page every 60 seconds
  };
};

export default function PagesISR({ generatedAt, data }: ISRPageProps) {
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
          Page Router ISR (Legacy) (Incremental Static Regeneration)
        </h1>

        <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
          <div className="mb-6 space-y-2 text-zinc-600 dark:text-zinc-400">
            <p>
              <strong>Router Type:</strong> Page Router
            </p>
            <p>
              <strong>Data Fetching:</strong> getStaticProps + revalidate
            </p>
            <p>
              <strong>Revalidation Period:</strong> 60 seconds
            </p>
            <p>
              <strong>Generated At:</strong> {generatedAt}
            </p>
          </div>

          <div className="rounded bg-indigo-50 p-4 dark:bg-indigo-900">
            <h2 className="mb-2 font-semibold text-indigo-800 dark:text-indigo-200">
              ISR Data
            </h2>
            <p className="text-indigo-700 dark:text-indigo-300">
              {data.message}
            </p>
            <p className="mt-2 font-mono text-indigo-600 dark:text-indigo-400">
              Random Value: {data.randomValue.toFixed(6)}
            </p>
          </div>

          <div className="mt-4 rounded bg-violet-50 p-3 dark:bg-violet-900">
            <h3 className="font-semibold text-violet-800 dark:text-violet-200">
              How ISR Works:
            </h3>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-violet-700 dark:text-violet-300">
              <li>
                First request after 60 seconds triggers background regeneration
              </li>
              <li>The stale page is served immediately to the user</li>
              <li>Next.js regenerates the page in the background</li>
              <li>Subsequent requests receive the fresh page</li>
            </ol>
          </div>

          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Refresh after 60 seconds to see different generatedAt and
            randomValue
          </p>
        </div>
      </main>
    </div>
  );
}
