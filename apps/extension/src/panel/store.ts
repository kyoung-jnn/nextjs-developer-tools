import { base64ToBytes } from '../shared/base64';
import type { BackgroundToPanelMessage, WireEvent } from '../shared/messages';
import type { CaptureKind, CaptureRecord, Detection, WireRecord } from '../shared/types';
import { type ParsedRecord, parseRecord } from './parse';
import type { SourceSnapshot } from './source';
export interface PanelRecord extends CaptureRecord {
  key: string;
  byteLength: number;
  generation: number;
  encoded: string[];
  debugEncoded: string[];
}
export interface PanelState {
  records: PanelRecord[];
  detection: Detection | null;
  url: string;
  selected: string | null;
  parsed: ParsedRecord | null;
  parsing: boolean;
  parseError: string | null;
  preserve: boolean;
  hidePrefetch: boolean;
  kind: CaptureKind | 'all';
  query: string;
}
export interface StoreOptions {
  now?: () => number;
  parse?: (record: CaptureRecord) => ParsedRecord | Promise<ParsedRecord>;
  schedule?: (work: () => void, delay: number) => unknown;
  cancel?: (timer: unknown) => void;
}
export function isPrefetch(record: CaptureRecord): boolean {
  return (
    record.kind === 'prefetch' ||
    Object.entries(record.requestHeaders).some(
      ([key, value]) =>
        (key.toLowerCase() === 'purpose' && value.toLowerCase() === 'prefetch') ||
        key.toLowerCase() === 'x-middleware-prefetch',
    )
  );
}
export function createPanelStore(snapshot: SourceSnapshot, options: StoreOptions = {}) {
  const now = options.now ?? Date.now;
  const parse = options.parse ?? parseRecord;
  const schedule = options.schedule ?? ((work, delay) => setTimeout(work, delay));
  const cancel =
    options.cancel ?? ((timer) => clearTimeout(timer as ReturnType<typeof setTimeout>));
  let generation = 0;
  const fromWire = (record: WireRecord, previous?: PanelRecord): PanelRecord => {
    const chunks = record.chunks.map((chunk, index) =>
      previous?.encoded[index] === chunk && previous.chunks[index]
        ? previous.chunks[index]
        : base64ToBytes(chunk),
    );
    const debugChunks = record.debugChunks.map((chunk, index) =>
      previous?.debugEncoded[index] === chunk && previous.debugChunks[index]
        ? previous.debugChunks[index]
        : base64ToBytes(chunk),
    );
    return {
      ...record,
      debugChunks,
      debugEncoded: record.debugChunks,
      encoded: record.chunks,
      chunks,
      key: `${generation}:${record.id}`,
      generation,
      byteLength: [...chunks, ...debugChunks].reduce((sum, chunk) => sum + chunk.length, 0),
    };
  };
  let state: PanelState = {
    records: snapshot.records.map((record) => fromWire(record)),
    detection: snapshot.detection,
    url: snapshot.url,
    selected: null,
    parsed: null,
    parsing: false,
    parseError: null,
    preserve: false,
    hidePrefetch: true,
    kind: 'all',
    query: '',
  };
  const listeners = new Set<() => void>();
  const cache = new Map<
    string,
    { size: number; parsed: ParsedRecord | null; error: string | null }
  >();
  let lastParse = -Infinity;
  let timer: unknown;
  let pending = false;
  let disposed = false;
  const notify = (): void => {
    for (const listener of listeners) listener();
  };
  function reparse(): void {
    if (disposed || pending) return;
    if (timer !== undefined) {
      cancel(timer);
      timer = undefined;
    }
    const record = state.records.find((record) => record.key === state.selected);
    if (!record) return;
    const cached = cache.get(record.key);
    if (cached?.size === record.byteLength) {
      state = { ...state, parsed: cached.parsed, parsing: false, parseError: cached.error };
      notify();
      return;
    }
    const delay =
      record.done && (!record.requestId || record.debugDone)
        ? 0
        : Math.max(0, 250 - (now() - lastParse));
    timer = schedule(() => {
      timer = undefined;
      lastParse = now();
      pending = true;
      const key = record.key,
        size = record.byteLength;
      state = { ...state, parsing: true, parseError: null };
      notify();
      Promise.resolve()
        .then(() => parse(record))
        .then((parsed) => {
          if (disposed) return;
          if (!state.records.some((record) => record.key === key)) return;
          cache.set(key, { size, parsed, error: null });
          if (state.selected === key)
            state = { ...state, parsed, parsing: false, parseError: null };
        })
        .catch((error) => {
          if (disposed || !state.records.some((record) => record.key === key)) return;
          cache.set(key, { size, parsed: null, error: String(error) });
          if (state.selected === key)
            state = { ...state, parsing: false, parseError: String(error) };
        })
        .finally(() => {
          pending = false;
          if (disposed) return;
          notify();
          const selected = state.records.find((record) => record.key === state.selected);
          if (selected && cache.get(selected.key)?.size !== selected.byteLength) reparse();
        });
    }, delay);
  }
  function update(message: BackgroundToPanelMessage): void {
    if (message.type === 'detect') state = { ...state, detection: message.detection };
    else if (message.type === 'reset') {
      generation++;
      state = {
        ...state,
        records: state.preserve ? state.records : [],
        detection: null,
        url: message.url,
        selected: state.preserve ? state.selected : null,
        parsed: state.preserve ? state.parsed : null,
        parsing: state.preserve ? state.parsing : false,
        parseError: state.preserve ? state.parseError : null,
      };
      if (!state.preserve) cache.clear();
    } else if (message.type === 'snapshot') {
      const old = new Map(
        state.records
          .filter((record) => record.generation === generation)
          .map((record) => [record.id, record]),
      );
      const records = message.records.map((record) => {
        const previous = old.get(record.id);
        return fromWire(record, previous);
      });
      state = {
        ...state,
        url: message.url,
        records: [
          ...state.records.filter((record) => record.generation !== generation),
          ...records,
        ],
      };
    } else applyEvent(message.event);
    if (!state.selected || !state.records.some((record) => record.key === state.selected))
      state = {
        ...state,
        selected: state.records.find((record) => !isPrefetch(record))?.key ?? null,
        parsed: null,
      };
    const keys = new Set(state.records.map((record) => record.key));
    for (const key of cache.keys()) if (!keys.has(key)) cache.delete(key);
    notify();
    reparse();
  }
  function applyEvent(event: WireEvent): void {
    if (event.type === 'detect') {
      state = { ...state, detection: event.detection };
      return;
    }
    if (event.type === 'record-start') {
      state = {
        ...state,
        records: [
          ...state.records,
          {
            ...event.record,
            chunks: [],
            debugChunks: [],
            debugDone: false,
            debugEncoded: [],
            encoded: [],
            done: false,
            key: `${generation}:${event.record.id}`,
            generation,
            byteLength: 0,
          },
        ],
      };
      return;
    }
    state = {
      ...state,
      records: state.records.map((record) => {
        if (
          record.id !== (event.type === 'debug-chunk' ? event.recordId : event.id) ||
          record.generation !== generation
        )
          return record;
        if (event.type === 'debug-chunk') {
          if (event.chunk === null) return { ...record, debugDone: true };
          const chunk = base64ToBytes(event.chunk);
          return {
            ...record,
            debugChunks: [...record.debugChunks, chunk],
            debugEncoded: [...record.debugEncoded, event.chunk],
            byteLength: record.byteLength + chunk.length,
          };
        }
        if (event.type === 'record-chunk') {
          const chunk = base64ToBytes(event.chunk);
          return {
            ...record,
            chunks: [...record.chunks, chunk],
            encoded: [...record.encoded, event.chunk],
            byteLength: record.byteLength + chunk.length,
          };
        }
        if (event.type === 'record-meta') {
          const { chunks, debugChunks, ...patch } = event.patch;
          return chunks || debugChunks
            ? fromWire(
                {
                  ...record,
                  ...patch,
                  chunks: chunks ?? record.encoded,
                  debugChunks: debugChunks ?? record.debugEncoded,
                },
                record,
              )
            : { ...record, ...patch };
        }

        return {
          ...record,
          done: true,
          endTime: event.endTime,
          ...(event.error ? { error: event.error } : {}),
        };
      }),
    };
  }
  const select = (key: string): void => {
    state = { ...state, selected: key, parsed: null, parseError: null };
    notify();
    reparse();
  };
  if (state.records.length) {
    state = {
      ...state,
      selected: state.records.find((record) => !isPrefetch(record))?.key ?? null,
    };
    reparse();
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update,
    select,
    setOptions: (
      patch: Partial<Pick<PanelState, 'preserve' | 'hidePrefetch' | 'kind' | 'query'>>,
    ) => {
      state = { ...state, ...patch };
      notify();
    },
    clear: () => {
      state = {
        ...state,
        records: [],
        selected: null,
        parsed: null,
        parseError: null,
        parsing: false,
      };
      if (timer !== undefined) {
        cancel(timer);
        timer = undefined;
      }
      cache.clear();
      notify();
    },
    dispose: () => {
      disposed = true;
      if (timer !== undefined) cancel(timer);
      listeners.clear();
    },
  };
}
export type PanelStore = ReturnType<typeof createPanelStore>;
