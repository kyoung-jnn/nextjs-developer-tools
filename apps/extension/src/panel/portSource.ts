import type { BackgroundToPanelMessage } from '../shared/messages';
import type { DataSource, SourceSnapshot } from './source';
export function createPortSource(): DataSource {
  let current: SourceSnapshot = { url: '', detection: null, records: [] };
  const listeners = new Set<(message: BackgroundToPanelMessage) => void>();
  let port: chrome.runtime.Port | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = true;
  function receive(message: BackgroundToPanelMessage): void {
    if (message.type === 'detect') current = { ...current, detection: message.detection };
    else if (message.type === 'reset') current = { url: message.url, detection: null, records: [] };
    else if (message.type === 'snapshot')
      current = { ...current, url: message.url, records: message.records };
    else {
      const event = message.event;
      if (event.type === 'detect') current = { ...current, detection: event.detection };
      else if (event.type === 'record-start')
        current = {
          ...current,
          records: [
            ...current.records,
            { ...event.record, chunks: [], debugChunks: [], debugDone: false, done: false },
          ],
        };
      else
        current = {
          ...current,
          records: current.records.map((record) => {
            if (record.id !== (event.type === 'debug-chunk' ? event.recordId : event.id))
              return record;
            if (event.type === 'debug-chunk')
              return event.chunk === null
                ? { ...record, debugDone: true }
                : { ...record, debugChunks: [...record.debugChunks, event.chunk] };
            if (event.type === 'record-chunk')
              return { ...record, chunks: [...record.chunks, event.chunk] };
            if (event.type === 'record-meta') return { ...record, ...event.patch };
            return {
              ...record,
              done: true,
              endTime: event.endTime,
              ...(event.error ? { error: event.error } : {}),
            };
          }),
        };
    }
    for (const listener of listeners) listener(message);
  }
  function connect(): void {
    if (stopped) return;
    try {
      const connected = chrome.runtime.connect({ name: 'panel' });
      port = connected;
      connected.onMessage.addListener(receive);
      connected.onDisconnect.addListener(() => {
        if (port !== connected) return;
        port = undefined;
        // Read lastError to avoid an unchecked-disconnect console warning.
        void chrome.runtime.lastError;
        if (!stopped) timer = setTimeout(connect, 1000);
      });
      connected.postMessage({ type: 'attach', tabId: chrome.devtools.inspectedWindow.tabId });
    } catch {
      if (!stopped) timer = setTimeout(connect, 1000);
    }
  }
  return {
    snapshot: () => current,
    subscribe(listener) {
      listeners.add(listener);
      if (stopped) {
        stopped = false;
        connect();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size) return;
        stopped = true;
        clearTimeout(timer);
        const connected = port;
        port = undefined;
        connected?.disconnect();
      };
    },
  };
}
