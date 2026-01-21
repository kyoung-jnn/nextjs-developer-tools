import { GetServerSideProps } from "next";

interface SSRPageProps {
  serverTime: string;
  requestId: string;
  data: {
    message: string;
    items: Array<{ id: number; value: string }>;
  };
}

export const getServerSideProps: GetServerSideProps<
  SSRPageProps
> = async () => {
  return {
    props: {
      serverTime: new Date().toISOString(),
      requestId: Math.random().toString(36).slice(2),
      data: {
        message: "Fetched on server via getServerSideProps",
        items: [
          { id: 1, value: "SSR Item 1" },
          { id: 2, value: "SSR Item 2" },
          { id: 3, value: "SSR Item 3" },
        ],
      },
    },
  };
};

export default function PagesSSR({
  serverTime,
  requestId,
  data,
}: SSRPageProps) {
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
          Page Router SSR (Legacy) (getServerSideProps)
        </h1>

        <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
          <div className="mb-6 space-y-2 text-zinc-600 dark:text-zinc-400">
            <p>
              <strong>Router Type:</strong> Page Router
            </p>
            <p>
              <strong>Data Fetching:</strong> getServerSideProps
            </p>
            <p>
              <strong>Server Time:</strong> {serverTime}
            </p>
            <p>
              <strong>Request ID:</strong> {requestId}
            </p>
          </div>

          <div className="rounded bg-cyan-50 p-4 dark:bg-cyan-900">
            <h2 className="mb-2 font-semibold text-cyan-800 dark:text-cyan-200">
              Server Data
            </h2>
            <p className="text-cyan-700 dark:text-cyan-300">{data.message}</p>
            <ul className="mt-2 space-y-1">
              {data.items.map((item) => (
                <li
                  key={item.id}
                  className="rounded bg-cyan-100 p-2 text-cyan-800 dark:bg-cyan-800 dark:text-cyan-200"
                >
                  {item.value} (ID: {item.id})
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Refresh the page to see new serverTime and requestId values
          </p>
        </div>
      </main>
    </div>
  );
}
