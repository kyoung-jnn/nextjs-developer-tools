import { deref, type FlightPayload, type TreeNode } from '@nextjs-devtools/flight-parser';
import type { ParsedRecord } from '../parse';
import { renderChildren, serverComponents } from '../presentation';
import type { PanelRecord } from '../store';
import { DEFAULT_SEARCH_BUDGET, type SearchOptions, searchValue } from './matchers';

/**
 * Searchable content of the Tree, Logs and Meta tabs (docs/design/10-search.md §11).
 * Every function mirrors exactly what the tab renders (same slices, same derived values), and
 * prefixes paths so the renderer can map matches back to the element it draws.
 */

export interface TabSearchResult {
  paths: string[][];
  limited: boolean;
}

/** Render limits shared by the Logs tab renderer and its search, so every match is drawable. */
export const LOG_LIMITS = { console: 200, rows: 100, components: 200, debug: 100 } as const;
/** Render limits shared by RenderTree and its search. */
export const TREE_LIMITS = { depth: 30 } as const;

function collector(query: string, opts: SearchOptions) {
  const paths: string[][] = [];
  let remaining = opts.budget ?? DEFAULT_SEARCH_BUDGET;
  let limited = false;
  const add = (value: unknown, prefix: string[]): void => {
    if (value === undefined) return;
    if (remaining <= 0) {
      limited = true;
      return;
    }
    const result = searchValue(value, query, { ...opts, budget: remaining });
    remaining -= Math.max(1, result.visited);
    limited ||= result.limited;
    for (const path of result.paths) paths.push([...prefix, ...path]);
  };
  return { add, result: (): TabSearchResult => ({ paths, limited }) };
}

/** Fields of the Request table, shared with the Meta renderer. */
export function requestFields(
  record: PanelRecord,
  formatStart: (ms: number) => string,
): [string, string][] {
  return [
    ['Method', record.method],
    ['URL', record.url],
    ['Started', formatStart(record.startTime)],
    ['Status', record.status === undefined ? '—' : String(record.status)],
    [
      'Duration',
      record.endTime === undefined
        ? 'Streaming'
        : `${Math.max(0, record.endTime - record.startTime)} ms`,
    ],
  ];
}

export function hasHeaderTables(record: PanelRecord): boolean {
  return record.kind !== 'document' && record.kind !== 'pages-document';
}

export function nextResponseMetadata(record: PanelRecord): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record.responseHeaders).filter(
      ([key]) => key.startsWith('x-nextjs-') || key === 'x-action-revalidated',
    ),
  );
}

export function pagesMetaValue(parsed: Extract<ParsedRecord, { type: 'pages' }>) {
  return { ...parsed.pages, raw: undefined, pageProps: undefined };
}

export function searchMeta(
  parsed: ParsedRecord | null,
  record: PanelRecord,
  query: string,
  opts: SearchOptions & { formatStart: (ms: number) => string },
): TabSearchResult {
  const { add, result } = collector(query, opts);
  if (!parsed || !query) return result();
  if (parsed.type === 'pages') add(pagesMetaValue(parsed), ['meta', 'pages']);
  else {
    add(parsed.next.buildId, ['meta', 'buildId']);
    add(parsed.next.canonicalUrl, ['meta', 'canonical']);
    if (parsed.next.routeTree) add(parsed.next.routeTree, ['meta', 'route']);
    for (const field of parsed.next.fields) {
      add(field.label, ['meta', 'field', field.key, 'label']);
      add(field.key, ['meta', 'field', field.key, 'key']);
      add(field.value, ['meta', 'field', field.key, 'value']);
    }
    add(record.formState, ['meta', 'formState']);
    add(nextResponseMetadata(record), ['meta', 'nextHeaders']);
  }
  for (const [label, value] of requestFields(record, opts.formatStart)) {
    add(label, ['meta', 'request', label, 'label']);
    add(value, ['meta', 'request', label, 'value']);
  }
  if (hasHeaderTables(record))
    for (const which of ['requestHeaders', 'responseHeaders'] as const)
      for (const [name, value] of Object.entries(record[which])) {
        add(name, ['meta', which, name, 'name']);
        add(value, ['meta', which, name, 'value']);
      }
  return result();
}

export function logRowValue(payload: FlightPayload, row: FlightPayload['rows'][number]) {
  return deref(payload, row.value) ?? row.value ?? row.text;
}

export function searchLogs(
  payload: FlightPayload,
  query: string,
  opts: SearchOptions,
): TabSearchResult {
  const { add, result } = collector(query, opts);
  if (!query) return result();
  payload.console.slice(0, LOG_LIMITS.console).forEach((entry, index) => {
    const prefix = ['logs', 'console', String(index)];
    add(entry.method, [...prefix, 'method']);
    add(entry.env, [...prefix, 'env']);
    add(entry.args, [...prefix, 'args']);
    add({ stack: entry.stack, owner: entry.owner }, [...prefix, 'stack']);
  });
  for (const kind of ['errors', 'io'] as const)
    payload[kind].slice(0, LOG_LIMITS.rows).forEach((row, index) => {
      add(logRowValue(payload, row), ['logs', kind, String(index)]);
    });
  for (const component of serverComponents(payload).slice(0, LOG_LIMITS.components)) {
    const prefix = ['logs', 'components', String(component.id)];
    add(component.name, [...prefix, 'name']);
    add(component.env, [...prefix, 'env']);
    add(String(component.key ?? '—'), [...prefix, 'key']);
    add(component.props, [...prefix, 'props']);
  }
  payload.debug.slice(0, LOG_LIMITS.debug).forEach((row, index) => {
    add(logRowValue(payload, row), ['logs', 'debug', String(index)]);
  });
  return result();
}

/** The label text RenderTree draws for a node. */
export function treeLabel(node: TreeNode): string {
  const element = ['element', 'client', 'suspense', 'fragment'].includes(node.kind);
  return element
    ? `<${node.label}${typeof node.props?.className === 'string' ? ` className=${JSON.stringify(node.props.className)}` : ''}>`
    : node.label.slice(0, 500);
}

export function treeChildren(node: TreeNode, renderMode: boolean, fragments: boolean): TreeNode[] {
  return renderMode ? renderChildren(node.children, fragments) : node.children;
}

export function searchTree(
  root: TreeNode,
  query: string,
  opts: SearchOptions & { renderMode: boolean; fragments: boolean },
): TabSearchResult {
  const { add, result } = collector(query, opts);
  if (!query) return result();
  const stack: { node: TreeNode; path: string[]; depth: number }[] = [
    { node: root, path: ['tree'], depth: 0 },
  ];
  let visited = 0;
  let limited = false;
  while (stack.length) {
    const frame = stack.pop();
    if (!frame) break;
    if (++visited > (opts.budget ?? DEFAULT_SEARCH_BUDGET)) {
      limited = true;
      break;
    }
    add(treeLabel(frame.node), [...frame.path, 'label']);
    if (frame.node.props) add(frame.node.props, [...frame.path, 'props']);
    // RenderTree renders children only while depth < TREE_LIMITS.depth.
    if (frame.depth >= TREE_LIMITS.depth) continue;
    const children = treeChildren(frame.node, opts.renderMode, opts.fragments);
    // Push in reverse so matches come out in document order.
    for (let index = children.length - 1; index >= 0; index--) {
      const child = children[index];
      if (child)
        stack.push({ node: child, path: [...frame.path, String(index)], depth: frame.depth + 1 });
    }
  }
  const output = result();
  return { paths: output.paths, limited: output.limited || limited };
}
