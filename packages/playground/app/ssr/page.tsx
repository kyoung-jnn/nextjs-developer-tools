export default async function SSRPage() {
  const fetchedAt = new Date().toISOString();

  // Simulate server-side data fetching
  const items = [
    { id: 1, name: "Server Item 1" },
    { id: 2, name: "Server Item 2" },
    { id: 3, name: "Server Item 3" },
  ];

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
          SSR Page (Server Component)
        </h1>

        <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
          <div className="mb-6 space-y-2 text-zinc-600 dark:text-zinc-400">
            <p>
              <strong>Router Type:</strong> App Router
            </p>
            <p>
              <strong>Fetched At:</strong> {fetchedAt}
            </p>
            <p>
              <strong>Source:</strong> Server Component (RSC)
            </p>
          </div>

          <h2 className="mb-4 text-xl font-semibold text-zinc-800 dark:text-zinc-200">
            Server-Fetched Items
          </h2>
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded bg-zinc-100 p-3 dark:bg-zinc-700"
              >
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {item.name}
                </span>
                <span className="ml-2 text-zinc-500 dark:text-zinc-400">
                  (ID: {item.id})
                </span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
