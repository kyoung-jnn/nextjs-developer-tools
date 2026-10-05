import { decodeJson, type FlightRef, type FlightValue, isRef } from './decode';
import { type FlightRow, tokenize } from './tokenizer';

export type RowKind =
  | 'model'
  | 'module'
  | 'hint'
  | 'error'
  | 'text'
  | 'debug'
  | 'io'
  | 'console'
  | 'time-origin'
  | 'stream'
  | 'binary'
  | 'unknown';

export interface ParsedRow {
  id: number;
  tag: string;
  kind: RowKind;
  byteLength: number;
  /** Decoded text of the row (binary rows are summarised instead). */
  text: string;
  /** Decoded value, when the row carries JSON. */
  value?: FlightValue;
  /** JSON parse error, if the row looked like JSON but did not parse. */
  parseError?: string;
}

export interface ClientModule {
  rowId: number;
  /** Bundler module id (webpack numeric id or turbopack path). */
  moduleId: string;
  chunks: string[];
  /** Export name ('default', '*', 'MyComponent', …). */
  name: string;
  async?: boolean;
}

export interface ConsoleEntry {
  rowId: number;
  method: string;
  env: string;
  args: FlightValue[];
  owner: FlightValue;
  stack: FlightValue;
}

export interface FlightPayload {
  rows: ParsedRow[];
  /** Latest model/text value per row id (what `$<id>` references resolve to). */
  chunks: Map<number, ParsedRow>;
  modules: Map<number, ClientModule>;
  hints: { code: string; value: FlightValue }[];
  errors: ParsedRow[];
  debug: ParsedRow[];
  io: ParsedRow[];
  console: ConsoleEntry[];
  totalBytes: number;
}

const decoder = new TextDecoder();

function kindOf(tag: string): RowKind {
  switch (tag) {
    case '':
      return 'model';
    case 'I':
      return 'module';
    case 'H':
      return 'hint';
    case 'E':
      return 'error';
    case 'T':
      return 'text';
    case 'D':
      return 'debug';
    case 'J':
      return 'io';
    case 'W':
      return 'console';
    case 'N':
      return 'time-origin';
    case 'R':
    case 'r':
    case 'X':
    case 'x':
    case 'C':
      return 'stream';
    case 'A':
    case 'O':
    case 'o':
    case 'U':
    case 'S':
    case 's':
    case 'L':
    case 'l':
    case 'G':
    case 'g':
    case 'M':
    case 'm':
    case 'V':
    case 'b':
      return 'binary';
    default:
      return 'unknown';
  }
}

function parseJsonRow(row: ParsedRow, text: string): void {
  try {
    row.value = decodeJson(JSON.parse(text));
  } catch (e) {
    row.parseError = e instanceof Error ? e.message : String(e);
  }
}

export function parseRow(raw: FlightRow): ParsedRow {
  const kind = kindOf(raw.tag);
  const row: ParsedRow = {
    id: raw.id,
    tag: raw.tag,
    kind,
    byteLength: raw.bytes.byteLength,
    text: '',
  };
  if (kind === 'binary') {
    row.text = `<${raw.bytes.byteLength} bytes>`;
    return row;
  }
  const text = decoder.decode(raw.bytes);
  row.text = text;
  switch (kind) {
    case 'text':
      row.value = text;
      break;
    case 'hint':
      // First char is the hint code (e.g. "L" for preload link), rest is JSON.
      parseJsonRow(row, text.slice(1));
      break;
    case 'time-origin':
      row.value = Number(text);
      break;
    case 'stream':
    case 'unknown':
      row.value = text;
      break;
    default:
      parseJsonRow(row, text);
  }
  return row;
}

function toModule(row: ParsedRow): ClientModule | null {
  const v = row.value;
  if (Array.isArray(v)) {
    return {
      rowId: row.id,
      moduleId: String(v[0] ?? ''),
      chunks: Array.isArray(v[1]) ? v[1].map(String) : [],
      name: typeof v[2] === 'string' ? v[2] : '',
      ...(typeof v[3] === 'boolean' ? { async: v[3] } : {}),
    };
  }
  if (v && typeof v === 'object' && 'id' in v) {
    const o = v as Record<string, FlightValue>;
    return {
      rowId: row.id,
      moduleId: String(o.id),
      chunks: Array.isArray(o.chunks) ? o.chunks.map(String) : [],
      name: typeof o.name === 'string' ? o.name : '',
      ...(typeof o.async === 'boolean' ? { async: o.async } : {}),
    };
  }
  return null;
}

function toConsole(row: ParsedRow): ConsoleEntry | null {
  const v = row.value;
  if (!Array.isArray(v)) return null;
  // [methodName, stackTrace, owner, env, ...args]
  return {
    rowId: row.id,
    method: typeof v[0] === 'string' ? v[0] : 'log',
    owner: v[2] ?? null,
    stack: v[1] ?? null,
    env: typeof v[3] === 'string' ? v[3] : 'Server',
    args: v.slice(4),
  };
}

export function buildPayload(rows: ParsedRow[]): FlightPayload {
  const payload: FlightPayload = {
    rows,
    chunks: new Map(),
    modules: new Map(),
    hints: [],
    errors: [],
    debug: [],
    io: [],
    console: [],
    totalBytes: 0,
  };
  for (const row of rows) {
    payload.totalBytes += row.byteLength;
    switch (row.kind) {
      case 'model':
      case 'text':
      case 'error':
        payload.chunks.set(row.id, row);
        if (row.kind === 'error') payload.errors.push(row);
        break;
      case 'module': {
        const mod = toModule(row);
        if (mod) payload.modules.set(row.id, mod);
        break;
      }
      case 'hint':
        payload.hints.push({ code: row.text[0] ?? '', value: row.value ?? null });
        break;
      case 'debug':
        payload.debug.push(row);
        break;
      case 'io':
        payload.io.push(row);
        payload.chunks.set(row.id, row);
        break;
      case 'console': {
        const entry = toConsole(row);
        if (entry) payload.console.push(entry);
        break;
      }
    }
  }
  return payload;
}

export function parseFlight(bytes: Uint8Array): FlightPayload {
  return buildPayload(tokenize(bytes).map(parseRow));
}

/** Follow a reference to the value it points at (one hop). */
export function resolveRef(payload: FlightPayload, ref: FlightRef): FlightValue | undefined {
  return resolve(payload, ref, { remaining: 32 });
}
function resolve(
  payload: FlightPayload,
  ref: FlightRef,
  budget: { remaining: number },
): FlightValue | undefined {
  if (budget.remaining-- <= 0) return undefined;
  const target = payload.chunks.get(ref.id);
  if (!target) {
    const mod = payload.modules.get(ref.id);
    if (mod) return { $flight: 'special', kind: 'client-module', value: describeModule(mod) };
    return undefined;
  }
  let value: FlightValue | undefined = target.value;
  for (const key of ref.path) {
    while (isRef(value) && budget.remaining > 0) value = resolve(payload, value, budget);
    if (isRef(value)) return undefined;
    if (value === null || typeof value !== 'object') return undefined;
    if (Array.isArray(value)) value = value[Number(key)];
    else if ('$flight' in value && value.$flight === 'element') {
      const el = value;
      value =
        key === 'props' ? el.props : key === 'type' ? el.type : key === 'key' ? el.key : undefined;
    } else value = (value as Record<string, FlightValue>)[key];
  }
  return value;
}

/** Follow references until reaching a non-reference value (bounded to avoid cycles). */
export function deref(
  payload: FlightPayload,
  value: FlightValue | undefined,
): FlightValue | undefined {
  let v = value;
  for (let hops = 0; hops < 32 && isRef(v); hops++) {
    v = resolveRef(payload, v);
  }
  return v;
}

export function describeModule(mod: ClientModule): string {
  // Turbopack ids look like "[project]/app/counter.tsx [app-client] (ecmascript)".
  const path = mod.moduleId.replace(/^\[project\]\//, '').replace(/\s*\[.*$/, '');
  const name = mod.name && mod.name !== 'default' && mod.name !== '*' ? mod.name : '';
  if (name) return path && !/^\d+$/.test(path) ? `${name} (${path})` : name;
  return path || `module ${mod.moduleId}`;
}

/** Keep main models authoritative while retaining debug metadata and console rows. */
export function mergePayloadRows(mainRows: ParsedRow[], debugRows: ParsedRow[]): ParsedRow[] {
  const protectedIds = new Set(
    mainRows.filter((row) => row.kind === 'model' || row.kind === 'text').map((row) => row.id),
  );
  return [
    ...debugRows.filter(
      (row) => !protectedIds.has(row.id) || (row.kind !== 'model' && row.kind !== 'text'),
    ),
    ...mainRows,
  ];
}
