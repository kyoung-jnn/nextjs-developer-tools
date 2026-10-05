import {
  buildPayload,
  buildRenderTree,
  buildTree,
  type ClientProps,
  collectClientProps,
  extractServerData,
  type FlightPayload,
  mergePayloadRows,
  type NextSummary,
  type PagesSummary,
  parseFlight,
  type ServerDataEntry,
  summarizeNext,
  summarizePagesData,
  summarizePagesDocument,
  type TreeNode,
} from '@nextjs-devtools/flight-parser';
import type { CaptureRecord } from '../shared/types';
export type ParsedRecord =
  | {
      type: 'flight';
      serverData: ServerDataEntry[];
      raw: string;
      logSource: 'debug channel' | 'inline' | 'none';
      payload: FlightPayload;
      tree: TreeNode;
      fullTree: TreeNode;
      clients: ClientProps[];
      next: NextSummary;
    }
  | {
      type: 'pages';
      serverData: ServerDataEntry[];
      raw: string;
      pages: PagesSummary;
      error?: string;
    };
export function parseRecord(record: CaptureRecord): ParsedRecord {
  const size = record.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of record.chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const raw = new TextDecoder().decode(bytes);
  if (record.kind === 'pages-document' || record.kind === 'pages-data') {
    let value: unknown;
    let error: string | undefined;
    try {
      value = JSON.parse(raw);
    } catch (failure) {
      error = String(failure);
    }
    const pages =
      record.kind === 'pages-document' ? summarizePagesDocument(value) : summarizePagesData(value);
    return {
      type: 'pages',
      serverData: extractServerData(pages.pageProps),
      raw,
      pages,
      ...(error ? { error } : {}),
    };
  }
  const debugSize = record.debugChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const debugBytes = new Uint8Array(debugSize);
  let debugOffset = 0;
  for (const chunk of record.debugChunks) {
    debugBytes.set(chunk, debugOffset);
    debugOffset += chunk.length;
  }
  const main = parseFlight(bytes);
  const debug = parseFlight(debugBytes);
  const payload = buildPayload(mergePayloadRows(main.rows, debug.rows));
  return {
    type: 'flight',
    serverData: extractServerData(payload),
    raw,
    payload,
    logSource: debugSize
      ? 'debug channel'
      : main.console.length || main.debug.length || main.io.length
        ? 'inline'
        : 'none',
    tree:
      size + debugSize > 1048576 ? limitTree(buildRenderTree(payload)) : buildRenderTree(payload),
    fullTree: size + debugSize > 1048576 ? limitTree(buildTree(payload)) : buildTree(payload),
    clients: collectClientProps(payload).slice(0, 1000),
    next: summarizeNext(payload),
  };
}

/** Bound the worker result graph before structured-cloning large display trees. */
function limitTree(root: TreeNode): TreeNode {
  let remaining = 2000;
  const visit = (node: TreeNode): TreeNode => {
    if (remaining-- <= 0)
      return { kind: 'value', label: 'Display limit reached · inspect Rows or Raw', children: [] };
    const children: TreeNode[] = [];
    for (const child of node.children) {
      if (remaining <= 0 || children.length >= 100) {
        children.push({ kind: 'value', label: 'More nodes · inspect Rows or Raw', children: [] });
        break;
      }
      children.push(visit(child));
    }
    return { ...node, children };
  };
  return visit(root);
}
