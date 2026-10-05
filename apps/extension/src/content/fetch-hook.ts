import { classifyRequest } from '../shared/classify';
import type { HookEvent } from '../shared/messages';
import { hasPrefetchHeaders } from './prefetch';
export interface FetchHookOptions {
  emit: (event: HookEvent) => void;
  nextId: () => string;
  baseUrl: () => string;
  now?: () => number;
  capturePrefetch?: () => boolean;
}
export function createFetchHook(original: typeof fetch, options: FetchHookOptions): typeof fetch {
  const clock = options.now ?? Date.now;
  const now = (): number => {
    try {
      return clock();
    } catch {
      return 0;
    }
  };
  const emit = (event: HookEvent): void => {
    try {
      options.emit(event);
    } catch {
      /* Capture failures do not affect fetch. */
    }
  };
  const read = async (response: Response, id: string): Promise<void> => {
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let error: string | undefined;
    try {
      reader = response.clone().body?.getReader();
      if (reader) {
        while (true) {
          const result = await reader.read();
          if (result.done) break;
          emit({ type: 'record-chunk', id, chunk: result.value });
        }
      }
    } catch (failure) {
      error = failure instanceof Error ? failure.message : String(failure);
    } finally {
      try {
        reader?.releaseLock();
      } catch {
        /* The stream may already be closed. */
      }
      emit({ type: 'record-end', id, endTime: now(), ...(error ? { error } : {}) });
    }
  };
  return async function (this: unknown, ...args: Parameters<typeof fetch>): Promise<Response> {
    // Preserve the original receiver, arguments, response, and rejection behavior.
    const startTime = now();
    const response = await Reflect.apply(original, this, args);
    const [input, init] = args;
    try {
      const request = input instanceof Request ? input : undefined;
      const url = new URL(request?.url ?? String(input), options.baseUrl()).href;
      const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
      const requestHeaders = Object.fromEntries(new Headers(init?.headers ?? request?.headers));
      const responseHeaders = Object.fromEntries(response.headers);
      const responseUrl = response.url || url;
      const kind = classifyRequest({ url: responseUrl, requestHeaders, responseHeaders });
      if (
        options.capturePrefetch?.() === false &&
        (kind === 'prefetch' || hasPrefetchHeaders(requestHeaders))
      )
        return response;
      if (kind) {
        const id = options.nextId();
        emit({
          type: 'record-start',
          record: {
            id,
            kind,
            url: responseUrl,
            method,
            requestHeaders,
            requestId: requestHeaders['x-nextjs-request-id'],
            responseHeaders: {},
            startTime,
          },
        });
        emit({ type: 'record-meta', id, patch: { status: response.status, responseHeaders } });
        void read(response, id);
      }
    } catch {
      /* Request inspection is best effort. */
    }
    return response;
  };
}
