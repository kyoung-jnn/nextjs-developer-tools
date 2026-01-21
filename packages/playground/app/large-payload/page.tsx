interface LargeItem {
  id: number;
  name: string;
  description: string;
  metadata: {
    createdAt: string;
    tags: string[];
    nested: {
      deep: {
        value: number;
      };
    };
  };
}

function generateLargeData(): LargeItem[] {
  return Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    name: `Large Item ${i}`,
    description: "A".repeat(500), // 500 character description
    metadata: {
      createdAt: new Date().toISOString(),
      tags: ["tag1", "tag2", "tag3"],
      nested: { deep: { value: i } },
    },
  }));
}

export default function LargePayloadPage() {
  const items = generateLargeData();

  // Calculate approximate size
  const jsonSize = JSON.stringify(items).length;
  const sizeInMB = (jsonSize / (1024 * 1024)).toFixed(2);

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
          Large Payload Page (1MB+ Data)
        </h1>

        <div className="mb-6 rounded-lg bg-orange-100 p-4 dark:bg-orange-900">
          <h2 className="text-lg font-semibold text-orange-800 dark:text-orange-200">
            Payload Statistics
          </h2>
          <div className="mt-2 space-y-1 text-orange-700 dark:text-orange-300">
            <p>
              <strong>Item Count:</strong> {items.length}
            </p>
            <p>
              <strong>Approximate Size:</strong> {sizeInMB} MB ({jsonSize}{" "}
              bytes)
            </p>
            <p>
              <strong>Purpose:</strong> Test Extension&apos;s large payload
              handling
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
          <h2 className="mb-4 text-xl font-semibold text-zinc-800 dark:text-zinc-200">
            Sample Items (First 10 of {items.length})
          </h2>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {items.slice(0, 10).map((item) => (
              <div
                key={item.id}
                className="rounded bg-zinc-100 p-3 dark:bg-zinc-700"
              >
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {item.name}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  ID: {item.id} | Tags: {item.metadata.tags.join(", ")}
                </p>
                <p className="mt-1 truncate text-xs text-zinc-400 dark:text-zinc-500">
                  Description: {item.description.substring(0, 50)}...
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
            ... and {items.length - 10} more items (check DevTools for full
            payload)
          </p>
        </div>
      </main>
    </div>
  );
}
