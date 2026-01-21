"use client";

import { useEffect, useState } from "react";

interface CSRData {
  clientTime: string;
  fetchedData: Array<{ id: number; name: string }>;
}

interface CSRState {
  loading: boolean;
  data: CSRData | null;
  error: string | null;
}

export default function PagesCSR() {
  const [state, setState] = useState<CSRState>({
    loading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    // Simulate client-side data fetching
    const fetchData = async () => {
      try {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 1000));

        setState({
          loading: false,
          data: {
            clientTime: new Date().toISOString(),
            fetchedData: [
              { id: 1, name: "Client Item 1" },
              { id: 2, name: "Client Item 2" },
              { id: 3, name: "Client Item 3" },
            ],
          },
          error: null,
        });
      } catch {
        setState({
          loading: false,
          data: null,
          error: "Failed to fetch data",
        });
      }
    };

    fetchData();
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
          Page Router CSR (Legacy) (Client-Side Only)
        </h1>

        <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
          <div className="mb-6 space-y-2 text-zinc-600 dark:text-zinc-400">
            <p>
              <strong>Router Type:</strong> Page Router
            </p>
            <p>
              <strong>Data Fetching:</strong> useEffect (Client-side only)
            </p>
            <p>
              <strong>SSR Props:</strong> None
            </p>
          </div>

          {state.loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-500 border-t-transparent"></div>
              <span className="ml-3 text-zinc-600 dark:text-zinc-400">
                Loading data on client...
              </span>
            </div>
          ) : state.error ? (
            <div className="rounded bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:text-red-200">
              Error: {state.error}
            </div>
          ) : (
            <div className="rounded bg-rose-50 p-4 dark:bg-rose-900">
              <h2 className="mb-2 font-semibold text-rose-800 dark:text-rose-200">
                Client-Fetched Data
              </h2>
              <p className="text-rose-700 dark:text-rose-300">
                <strong>Fetched At:</strong> {state.data?.clientTime}
              </p>
              <ul className="mt-3 space-y-1">
                {state.data?.fetchedData.map((item) => (
                  <li
                    key={item.id}
                    className="rounded bg-rose-100 p-2 text-rose-800 dark:bg-rose-800 dark:text-rose-200"
                  >
                    {item.name} (ID: {item.id})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 rounded bg-amber-50 p-3 dark:bg-amber-900">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Note:</strong> This page has no server-side data fetching.
              The server sends a minimal HTML shell, and all data is fetched on
              the client after hydration. Check the initial HTML source to see
              the loading state.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
