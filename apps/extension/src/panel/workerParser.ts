import type { CaptureRecord } from '../shared/types';
import type { ParsedRecord } from './parse';
export function createWorkerParser() {
  const worker = new Worker(new URL('panel-worker.js', location.href));
  let id = 0;
  const pending = new Map<
    number,
    { resolve: (parsed: ParsedRecord) => void; reject: (error: Error) => void }
  >();
  worker.onmessage = (
    event: MessageEvent<{ id: number; parsed?: ParsedRecord; error?: string }>,
  ) => {
    const request = pending.get(event.data.id);
    if (!request) return;
    pending.delete(event.data.id);
    if (event.data.parsed) request.resolve(event.data.parsed);
    else request.reject(new Error(event.data.error ?? 'Payload parsing failed'));
  };
  worker.onerror = () => {
    for (const request of pending.values()) request.reject(new Error('Payload worker failed'));
    pending.clear();
  };
  return {
    parse: (record: CaptureRecord) =>
      new Promise<ParsedRecord>((resolve, reject) => {
        const next = ++id;
        pending.set(next, { resolve, reject });
        worker.postMessage({ id: next, record });
      }),
    dispose: () => {
      worker.terminate();
      for (const request of pending.values()) request.reject(new Error('Panel closed'));
      pending.clear();
    },
  };
}
