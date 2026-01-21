"use client";

import { useState } from "react";

export default function ClientInteraction() {
  const [interactionCount, setInteractionCount] = useState(0);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const handleClick = () => {
    setInteractionCount((prev) => prev + 1);
    setLastAction(new Date().toISOString());
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
      <h2 className="mb-4 text-xl font-semibold text-green-700 dark:text-green-400">
        Client Component Data
      </h2>
      <div className="space-y-4">
        <div className="space-y-2 text-zinc-600 dark:text-zinc-400">
          <p>
            <strong>Interaction Count:</strong> {interactionCount}
          </p>
          <p>
            <strong>Last Action:</strong> {lastAction || "No actions yet"}
          </p>
        </div>

        <button
          onClick={handleClick}
          className="w-full rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none"
        >
          Click to Interact
        </button>

        <p className="rounded bg-green-50 p-2 text-sm text-green-800 dark:bg-green-900 dark:text-green-200">
          This component is hydrated on the client and handles user
          interactions.
        </p>
      </div>
    </div>
  );
}
