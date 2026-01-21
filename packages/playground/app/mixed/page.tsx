import ClientInteraction from "./ClientInteraction";

export default function MixedPage() {
  const serverData = {
    timestamp: new Date().toISOString(),
    message: "Rendered on server",
  };

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
          Mixed Page (SSR + CSR Hybrid)
        </h1>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Server-rendered section */}
          <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
            <h2 className="mb-4 text-xl font-semibold text-blue-700 dark:text-blue-400">
              Server Component Data
            </h2>
            <div className="space-y-2 text-zinc-600 dark:text-zinc-400">
              <p>
                <strong>Timestamp:</strong> {serverData.timestamp}
              </p>
              <p>
                <strong>Message:</strong> {serverData.message}
              </p>
              <p className="mt-4 rounded bg-blue-50 p-2 text-sm text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                This data was rendered on the server and will not change on
                client interaction.
              </p>
            </div>
          </div>

          {/* Client-rendered section */}
          <ClientInteraction />
        </div>
      </main>
    </div>
  );
}
