import { type FlightValue, isElement, isRef, isSpecial } from './decode';
import { deref, type FlightPayload, resolveRef } from './payload';

export type ServerDataSource =
  | 'tanstack-query'
  | 'swr'
  | 'apollo'
  | 'redux'
  | 'urql'
  | 'streamed-promise'
  | 'server-io';

export interface ServerDataEntry {
  source: ServerDataSource;
  label: string;
  location: string;
  status?: string;
  updatedAt?: number;
  durationMs?: number;
  data: FlightValue;
  meta?: Record<string, FlightValue>;
}

const OMITTED = 'omitted by React (object limit)';
const NO_BODY =
  'The response body was not read on the server (no .json()/.text() call was recorded).';
const MAX_DEPTH = 100;
const MAX_NODES = 50_000;
const special = (kind: string, value?: string): FlightValue => ({
  $flight: 'special',
  kind,
  ...(value ? { value } : {}),
});
function object(value: unknown): value is Record<string, unknown> {
  return (
    value !== null && typeof value === 'object' && !Array.isArray(value) && !('$flight' in value)
  );
}
function isPayload(value: unknown): value is FlightPayload {
  return (
    object(value) &&
    value.chunks instanceof Map &&
    value.modules instanceof Map &&
    Array.isArray(value.rows) &&
    Array.isArray(value.io)
  );
}

/** Extract only recognizable client-visible data and development I/O metadata. */
export function extractServerData(input: unknown): ServerDataEntry[] {
  const entries: ServerDataEntry[] = [];
  let remaining = MAX_NODES;
  try {
    const payload = isPayload(input) ? input : undefined;
    // Owners and deferred debug data may live in D rows outside the chunks map.
    const references = payload ? { ...payload, chunks: new Map(payload.chunks) } : undefined;
    if (references && payload) {
      for (const row of payload.rows.slice(0, MAX_NODES)) {
        if (row.value !== undefined && !references.chunks.has(row.id))
          references.chunks.set(row.id, row);
      }
    }
    function follow(value: unknown): unknown {
      if (!references || !isRef(value)) return value;
      if (--remaining <= 0) return value;
      const resolved = deref(references, value);
      if (resolved !== undefined) return resolved;
      // Keep the terminal missing marker (particularly $Y), rather than its first ref.
      let current = value;
      const seen = new Set<object>();
      for (let hops = 0; hops < 32 && remaining > 0; hops++) {
        if (seen.has(current)) break;
        seen.add(current);
        remaining--;
        const next = resolveRef(references, current);
        if (next === undefined) return current;
        if (!isRef(next)) return next;
        current = next;
      }
      return current;
    }
    function expand(
      value: unknown,
      seen: Set<object>,
      depth: number,
      meta: Record<string, FlightValue>,
    ): FlightValue {
      if (--remaining < 0) return special('truncated', 'Node budget exceeded');
      if (depth >= MAX_DEPTH) return special('truncated', 'Depth limit reached');
      if (isRef(value)) {
        if (seen.has(value)) return special('circular', value.raw);
        const resolved = follow(value);
        if (resolved !== value && !isRef(resolved)) {
          seen.add(value);
          const result = expand(resolved, seen, depth + 1, meta);
          seen.delete(value);
          return result;
        }
        if (value.raw.startsWith('$Y')) {
          meta.omitted = OMITTED;
          return special('omitted', OMITTED);
        }
        return value;
      }
      if (value === undefined) return special('undefined');
      if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      )
        return value;
      if (typeof value !== 'object') return special(typeof value, String(value));
      if (seen.has(value)) return special('circular', '(circular)');
      seen.add(value);
      let result: FlightValue;
      if (Array.isArray(value)) {
        const list: FlightValue[] = [];
        for (const child of value) {
          list.push(expand(child, seen, depth + 1, meta));
          if (remaining <= 0) break;
        }
        result = list;
      } else {
        const fields: Record<string, FlightValue> = {};
        for (const [key, child] of Object.entries(value)) {
          Object.defineProperty(fields, key, {
            value: expand(child, seen, depth + 1, meta),
            enumerable: true,
            configurable: true,
            writable: true,
          });
          if (remaining <= 0) break;
        }
        result = fields;
      }
      seen.delete(value);
      return result;
    }
    function add(
      entry: Omit<ServerDataEntry, 'data' | 'meta'>,
      value: unknown,
      rawMeta: Record<string, unknown> = {},
    ): void {
      if (remaining <= 0) return;
      const meta: Record<string, FlightValue> = {};
      const data = expand(value, new Set(), 0, meta);
      for (const [key, item] of Object.entries(rawMeta)) {
        if (remaining <= 0) break;
        meta[key] = expand(item, new Set(), 0, meta);
      }
      entries.push({ ...entry, data, ...(Object.keys(meta).length ? { meta } : {}) });
    }
    function shape(value: unknown): Record<string, unknown> | undefined {
      const resolved = follow(value);
      return object(resolved) ? resolved : undefined;
    }
    function recognize(value: Record<string, unknown>, key: string, location: string): void {
      const queries = follow(value.queries);
      const mutations = follow(value.mutations);
      if (Array.isArray(queries) && Array.isArray(mutations)) {
        for (const item of queries) {
          if (remaining <= 0) break;
          const query = shape(item);
          const state = shape(query?.state);
          const queryKey = follow(query?.queryKey);
          if (!query || !state || !Array.isArray(queryKey) || typeof state.status !== 'string')
            continue;
          let data = state.data;
          let status = state.status;
          const meta: Record<string, unknown> = {};
          for (const name of ['queryHash', 'dehydratedAt', 'meta'])
            if (query[name] !== undefined) meta[name] = query[name];
          for (const name of ['error', 'fetchStatus'])
            if (state[name] !== undefined) meta[name] = state[name];
          const promise = query.promise;
          if (
            (data === undefined || (isSpecial(data) && data.kind === 'undefined')) &&
            isRef(promise) &&
            promise.kind === 'promise'
          ) {
            data = follow(promise);
            if (!isRef(data)) {
              meta.streamed = true;
              meta.queryStatus = state.status;
              status = 'streamed';
            } else status = 'pending';
          }
          add(
            {
              source: 'tanstack-query',
              label: JSON.stringify(expand(queryKey, new Set(), 0, {})),
              location,
              status,
              ...(typeof state.dataUpdatedAt === 'number'
                ? { updatedAt: state.dataUpdatedAt }
                : {}),
            },
            data,
            meta,
          );
        }
        return;
      }
      if (key === 'fallback') {
        for (const [label, data] of Object.entries(value)) {
          if (remaining <= 0) break;
          add({ source: 'swr', label, location }, data);
        }
      } else if (key === '__APOLLO_STATE__' || key === 'initialApolloState') {
        const root = shape(value.ROOT_QUERY);
        if (root)
          for (const [label, data] of Object.entries(root)) {
            if (remaining <= 0) break;
            add({ source: 'apollo', label, location }, data, { cache: value });
          }
      } else if (key === 'initialReduxState' || key === 'preloadedState') {
        add({ source: 'redux', label: key, location }, value);
      } else if (key === 'urqlState') {
        for (const [label, raw] of Object.entries(value)) {
          if (remaining <= 0) break;
          const item = shape(raw);
          if (item && ('data' in item || 'error' in item))
            add(
              { source: 'urql', label, location },
              item.data,
              item.error !== undefined ? { error: item.error } : {},
            );
        }
      }
    }
    function scan(
      raw: unknown,
      key: string,
      location: string,
      depth: number,
      seen: Set<object>,
    ): void {
      if (--remaining <= 0 || depth >= MAX_DEPTH) return;
      const value = follow(raw);
      if (
        value === null ||
        typeof value !== 'object' ||
        isRef(value) ||
        isSpecial(value) ||
        seen.has(value)
      )
        return;
      seen.add(value);
      if (object(value)) recognize(value, key, location);
      // Array Redux state is valid too.
      else if (Array.isArray(value) && (key === 'preloadedState' || key === 'initialReduxState'))
        add({ source: 'redux', label: key, location }, value);
      for (const [name, child] of Object.entries(value)) {
        if (remaining <= 0) break;
        scan(child, name, `${location}.${name}`, depth + 1, seen);
      }
      seen.delete(value);
    }
    function findClients(raw: unknown, depth: number, seen: Set<object>): void {
      if (--remaining <= 0 || depth >= MAX_DEPTH) return;
      const value = follow(raw);
      if (
        value === null ||
        typeof value !== 'object' ||
        isRef(value) ||
        isSpecial(value) ||
        seen.has(value)
      )
        return;
      seen.add(value);
      if (isElement(value)) {
        const module = isRef(value.type) ? payload?.modules.get(value.type.id) : undefined;
        if (module) {
          const path = module.moduleId.replace(/^\[project\]\//, '').replace(/\s*\[.*$/, '');
          const component =
            module.name && module.name !== 'default' && module.name !== '*'
              ? module.name
              : path.includes('/')
                ? path.split('/').at(-1)
                : `Client#${module.moduleId}`;
          for (const [key, prop] of Object.entries(value.props)) {
            if (remaining <= 0) break;
            if (key === 'children') continue;
            const location = `${component}.${key}`;
            if (isRef(prop) && prop.kind === 'promise') {
              const data = follow(prop);
              add(
                {
                  source: 'streamed-promise',
                  label: key,
                  location,
                  status: isRef(data) ? 'pending' : 'resolved',
                },
                data,
              );
            }
            scan(prop, key, location, 0, new Set());
          }
        }
        findClients(value.props.children, depth + 1, seen);
      } else {
        for (const child of Object.values(value)) {
          if (remaining <= 0) break;
          findClients(child, depth + 1, seen);
        }
      }
      seen.delete(value);
    }
    if (payload) {
      // Dev-only server I/O (docs/design/09 §1.1, §3). Each awaited fetch emits a J row whose value
      // is the serialized Response; a later `_Response.json`/`_Response.text` J row of the same
      // owner carries the parsed body. Merge each pair into one entry.
      interface IoRow {
        id: number;
        io: Record<string, unknown>;
        name: string;
        start: number;
        end: number;
        ownerKey: string | undefined;
        ownerName: string | undefined;
        response: Record<string, unknown> | undefined;
        body?: IoRow;
        paired: boolean;
      }
      const rows: IoRow[] = [];
      for (const row of payload.io) {
        if (--remaining <= 0) break;
        const io = shape(row.value);
        if (!io || typeof io.name !== 'string' || !('value' in io)) continue;
        const owner = shape(io.owner);
        const ownerName = typeof owner?.name === 'string' ? owner.name : undefined;
        const response = shape(io.value);
        rows.push({
          id: row.id,
          io,
          name: io.name,
          start: typeof io.start === 'number' ? io.start : Number.NaN,
          end: typeof io.end === 'number' ? io.end : Number.NaN,
          ownerKey: isRef(io.owner) ? io.owner.raw : ownerName,
          ownerName,
          response:
            response && typeof response.url === 'string' && typeof response.status === 'number'
              ? response
              : undefined,
          paired: false,
        });
      }
      // J rows are emitted in completion order, not call order.
      rows.sort((a, b) => (a.start || 0) - (b.start || 0));
      const isBodyRead = (row: IoRow) => /(^|[._])Response\.(json|text)$/.test(row.name);
      for (const read of rows) {
        if (!isBodyRead(read) || read.ownerKey === undefined) continue;
        // FIFO: the earliest unpaired fetch of the same owner that finished before the read began.
        const fetchRow = rows.find(
          (candidate) =>
            candidate.response !== undefined &&
            candidate.body === undefined &&
            candidate.ownerKey === read.ownerKey &&
            !(candidate.end > read.start),
        );
        if (fetchRow) {
          fetchRow.body = read;
          read.paired = true;
        }
      }
      // Fetches first (call order), then other I/O such as Next's headers().
      const ordered = [
        ...rows.filter((row) => row.response),
        ...rows.filter((row) => !row.response),
      ];
      for (const row of ordered) {
        if (remaining <= 0) break;
        if (row.paired) continue;
        const meta: Record<string, unknown> = {};
        for (const key of ['env', 'stack']) if (row.io[key] !== undefined) meta[key] = row.io[key];
        if (row.ownerName) meta.owner = row.ownerName;
        const location = row.ownerName ?? `Flight J:${row.id.toString(16)}`;
        const durationMs = Number.isFinite(row.end - row.start) ? row.end - row.start : undefined;
        const timing = durationMs === undefined ? {} : { durationMs };
        if (row.response) {
          const { headers, url, status, statusText, ok, redirected } = row.response;
          meta.response = { url, status, statusText, ok, redirected, headers };
          if (row.body) meta.bodyRead = row.body.name;
          else meta.note = NO_BODY;
          add(
            {
              source: 'server-io',
              label: `fetch ${String(url)}`,
              location,
              status: String(status),
              ...timing,
            },
            row.body ? row.body.io.value : row.io.value,
            meta,
          );
        } else {
          add(
            {
              source: 'server-io',
              label: isBodyRead(row)
                ? `response body (${row.ownerName ?? 'unknown owner'})`
                : row.name,
              location,
              ...timing,
            },
            row.io.value,
            meta,
          );
        }
      }
      findClients(payload.chunks.get(0)?.value, 0, new Set());
    } else scan(input, '', 'pageProps', 0, new Set());
  } catch {
    // Malformed values, getters, and unexpected debug shapes must not break the panel.
  }
  return entries;
}
