import { isElement, isRef, isSpecial, type ParsedRow } from '@nextjs-devtools/flight-parser';

export interface SearchOptions {
  caseSensitive?: boolean;
  budget?: number;
  formatDate?: (value: string) => string;
}
export interface ValueSearchResult {
  paths: string[][];
  count: number;
  limited: boolean;
  visited: number;
}
export interface TextRange {
  start: number;
  end: number;
}
export const DEFAULT_SEARCH_BUDGET = 200_000;

/** JSON encoding keeps dots, slashes, quotes and empty keys unambiguous. */
export function pathKey(path: readonly string[]): string {
  return JSON.stringify(path);
}
export function ancestorPaths(paths: readonly (readonly string[])[]): Set<string> {
  const result = new Set<string>();
  for (const path of paths) {
    for (let length = 0; length <= path.length; length++)
      result.add(pathKey(path.slice(0, length)));
  }
  return result;
}

function includes(text: string, query: string, caseSensitive = false): boolean {
  return caseSensitive ? text.includes(query) : text.toLowerCase().includes(query.toLowerCase());
}

/** The primitive text displayed by JsonTree. Objects are searched through their children. */
function display(value: unknown, opts: SearchOptions): string | undefined {
  if (isRef(value)) return value.raw;
  if (isSpecial(value)) {
    const kind = value.kind === 'date' ? 'Date' : value.kind === 'symbol' ? 'Symbol' : value.kind;
    return (
      kind +
      (value.value === undefined
        ? ''
        : `(${value.kind === 'date' && typeof value.value === 'string' && opts.formatDate ? opts.formatDate(value.value) : value.value})`)
    );
  }
  if (value === null || typeof value !== 'object') return String(value);
  return undefined;
}

function* ownKeys(value: object): Generator<string> {
  // Enumerate incrementally so a large array does not allocate every child path before the budget check.
  for (const key in value) if (Object.hasOwn(value, key)) yield key;
}

export function searchValue(
  value: unknown,
  query: string,
  opts: SearchOptions = {},
): ValueSearchResult {
  const result: ValueSearchResult = { paths: [], count: 0, limited: false, visited: 0 };
  if (!query) return result;
  const requested = opts.budget ?? DEFAULT_SEARCH_BUDGET;
  const budget = Number.isFinite(requested)
    ? Math.max(0, Math.floor(requested))
    : DEFAULT_SEARCH_BUDGET;
  type Frame = {
    source: Record<string, unknown>;
    identity: object;
    keys: Generator<string>;
    path: string[];
  };
  const stack: Frame[] = [];
  const active = new WeakSet<object>();
  let visited = 0;
  let pending: { value: unknown; path: string[] } | undefined = { value, path: [] };
  while (pending || stack.length) {
    if (!pending) {
      const frame = stack[stack.length - 1];
      if (!frame) break;
      try {
        const next = frame.keys.next();
        if (next.done) {
          active.delete(frame.identity);
          stack.pop();
          continue;
        }
        if (visited >= budget) {
          result.limited = true;
          break;
        }
        try {
          pending = { value: frame.source[next.value], path: [...frame.path, next.value] };
        } catch {
          visited++;
          result.limited = true;
          continue;
        }
      } catch {
        // A getter or proxy may be inaccessible; retain all earlier matches and continue safely.
        result.limited = true;
        continue;
      }
    }
    if (visited >= budget) {
      result.limited = true;
      break;
    }
    visited++;
    const node = pending;
    pending = undefined;
    try {
      const key = node.path.at(-1);
      const text = display(node.value, opts);
      if (
        (key !== undefined && includes(key, query, opts.caseSensitive)) ||
        (text !== undefined && includes(text, query, opts.caseSensitive))
      )
        result.paths.push(node.path);
      if (
        text !== undefined ||
        !node.value ||
        typeof node.value !== 'object' ||
        active.has(node.value)
      )
        continue;
      const object = isElement(node.value)
        ? {
            type: node.value.type,
            key: node.value.key,
            props: node.value.props,
            extra: node.value.extra,
          }
        : node.value;
      active.add(node.value);
      stack.push({
        source: object as Record<string, unknown>,
        identity: node.value,
        keys: ownKeys(object),
        path: node.path,
      });
    } catch {
      result.limited = true;
    }
  }
  result.visited = visited;
  result.count = result.paths.length;
  return result;
}

/** Non-overlapping substring matches, measured in the original string's UTF16 code units. */
export function searchText(text: string, query: string, opts: SearchOptions = {}): TextRange[] {
  if (!query) return [];
  const haystack = opts.caseSensitive ? text : text.toLowerCase();
  const needle = opts.caseSensitive ? query : query.toLowerCase();
  const ranges: TextRange[] = [];
  const requested = opts.budget ?? DEFAULT_SEARCH_BUDGET;
  const budget = Number.isFinite(requested)
    ? Math.max(0, Math.floor(requested))
    : DEFAULT_SEARCH_BUDGET;
  // Most lowercasing preserves length, including supplementary characters. Only allocate mappings
  // when it changes length (for example, İ becomes i plus a combining dot).
  let starts: number[] | undefined;
  let ends: number[] | undefined;
  if (haystack.length !== text.length) {
    starts = [];
    ends = [];
    let original = 0;
    for (const character of text) {
      const folded = character.toLowerCase();
      for (let i = 0; i < folded.length; i++) {
        starts.push(original + Math.min(i, character.length - 1));
        ends.push(original + Math.min(i + 1, character.length));
      }
      original += character.length;
    }
  }
  let cursor = 0;
  let previousEnd = 0;
  while (cursor <= haystack.length - needle.length && ranges.length < budget) {
    const index = haystack.indexOf(needle, cursor);
    if (index < 0) break;
    const start = starts?.[index] ?? index;
    const end = ends?.[index + needle.length - 1] ?? index + needle.length;
    if (start >= previousEnd) {
      ranges.push({ start, end });
      previousEnd = end;
    }
    cursor = index + needle.length;
  }
  return ranges;
}

/** Return source row indices so filtering never changes navigation identities. */
export function searchRows(
  rows: readonly ParsedRow[],
  query: string,
  opts: SearchOptions = {},
): number[] {
  if (!query) return [];
  const result: number[] = [];
  rows.forEach((row, index) => {
    try {
      if (
        [row.id.toString(16), row.tag, row.kind, row.text].some((text) =>
          includes(text, query, opts.caseSensitive),
        ) ||
        (row.value !== undefined && searchValue(row.value, query, opts).count > 0)
      )
        result.push(index);
    } catch {
      /* Malformed rows should not prevent searching the remaining payload. */
    }
  });
  return result;
}
