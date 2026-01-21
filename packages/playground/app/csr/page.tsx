"use client";

import { useEffect, useState } from "react";

interface ClientData {
  clientTime: string;
  browserInfo: string;
  hydrated: boolean;
}

export default function CSRPage() {
  const [data, setData] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate client-side data loading
    const timer = setTimeout(() => {
      setData({
        clientTime: new Date().toISOString(),
        browserInfo: navigator.userAgent,
        hydrated: true,
      });
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

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
          CSR Page (Client Component)
        </h1>

        <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
          <div className="mb-6 space-y-2 text-zinc-600 dark:text-zinc-400">
            <p>
              <strong>Router Type:</strong> App Router
            </p>
            <p>
              <strong>Render Type:</strong> Client Component (&apos;use
              client&apos;)
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
              <span className="ml-3 text-zinc-600 dark:text-zinc-400">
                Loading client data...
              </span>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
                Client-Side Data
              </h2>
              <div className="space-y-2 rounded bg-zinc-100 p-4 dark:bg-zinc-700">
                <p className="text-zinc-700 dark:text-zinc-300">
                  <strong>Client Time:</strong> {data?.clientTime}
                </p>
                <p className="text-zinc-700 dark:text-zinc-300">
                  <strong>Hydrated:</strong> {data?.hydrated ? "Yes" : "No"}
                </p>
                <p className="text-sm break-all text-zinc-600 dark:text-zinc-400">
                  <strong>Browser:</strong> {data?.browserInfo}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
