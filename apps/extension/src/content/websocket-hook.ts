import type { HookEvent } from '../shared/messages';

export function decodeDebugFrame(
  bytes: Uint8Array,
): Extract<HookEvent, { type: 'debug-chunk' }> | null {
  const length = bytes[1];
  if (bytes[0] !== 0 || length === undefined || length === 0 || bytes.length < length + 2)
    return null;
  const requestId = new TextDecoder().decode(bytes.subarray(2, length + 2));
  const chunk = bytes.slice(length + 2);
  return { type: 'debug-chunk', requestId, chunk: chunk.length ? chunk : null };
}

/** Observe debug frames without replacing the page's socket handlers. */
export function createWebSocketHook(
  original: typeof WebSocket,
  emit: (event: Extract<HookEvent, { type: 'debug-chunk' }>) => void,
  onHmr?: () => void,
): typeof WebSocket {
  return new Proxy(original, {
    construct(target, args, newTarget) {
      const socket: WebSocket = Reflect.construct(target, args, newTarget);
      try {
        const url = String(args[0]);
        if (url.includes('/_next/webpack-hmr')) onHmr?.();
        if (!url.includes('/_next/')) return socket;
        let pending = Promise.resolve();
        socket.addEventListener('message', (event: MessageEvent<unknown>) => {
          const data = event.data;
          if (!(data instanceof ArrayBuffer) && !(data instanceof Blob)) return;
          pending = pending
            .then(async () => {
              const bytes = new Uint8Array(data instanceof Blob ? await data.arrayBuffer() : data);
              const frame = decodeDebugFrame(bytes);
              if (frame) emit(frame);
            })
            .catch(() => {
              /* Observation must never affect the socket. */
            });
        });
      } catch {
        /* Preserve constructor behavior if instrumentation fails. */
      }
      return socket;
    },
  });
}
