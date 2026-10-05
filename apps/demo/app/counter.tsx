'use client';
import { useState } from 'react';

interface CounterProps {
  message: string;
  createdAt: Date;
  details: { user: { name: string }; tags: string[] };
  items: number[];
}
export default function Counter({ message, createdAt, details, items }: CounterProps) {
  const [count, setCount] = useState(0);
  return (
    <section>
      <h2>Client Counter</h2>
      <p>{message}</p>
      <p>{createdAt.toISOString()}</p>
      <pre>{JSON.stringify({ details, items }, null, 2)}</pre>
      <button type="button" onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
    </section>
  );
}
