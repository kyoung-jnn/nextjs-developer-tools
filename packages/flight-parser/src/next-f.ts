/**
 * Next.js App Router inlines the initial Flight stream into the HTML as
 *
 *   (self.__next_f = self.__next_f || []).push([0])   bootstrap
 *   self.__next_f.push([1, "<text chunk>"])            text chunk
 *   self.__next_f.push([2, <formState>])               form state
 *   self.__next_f.push([3, "<base64>"])                binary chunk
 *
 * (see next/src/server/app-render/use-flight-response.tsx)
 */

export type NextFSegment = [0] | [1, string] | [2, unknown] | [3, string];

const encoder = new TextEncoder();

export function segmentToBytes(seg: unknown): Uint8Array | null {
  if (!Array.isArray(seg)) return null;
  if (seg[0] === 1 && typeof seg[1] === 'string') return encoder.encode(seg[1]);
  if (seg[0] === 3 && typeof seg[1] === 'string') {
    try {
      return Uint8Array.from(atob(seg[1]), (c) => c.charCodeAt(0));
    } catch {
      return null;
    }
  }
  return null;
}

/** Concatenate all data segments into the raw Flight byte stream. */
export function segmentsToBytes(segments: readonly unknown[]): Uint8Array {
  const parts: Uint8Array[] = [];
  let total = 0;
  for (const seg of segments) {
    const bytes = segmentToBytes(seg);
    if (bytes) {
      parts.push(bytes);
      total += bytes.byteLength;
    }
  }
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.byteLength;
  }
  return out;
}

const PUSH_RE = /self\.__next_f\.push\(\s*/g;

/**
 * Fallback for when the document_start hook missed the pushes (e.g. the tab
 * was open before the extension was installed): extract segments from inline
 * `<script>` text. The pushed argument is JSON (`htmlEscapeJsonString(JSON.stringify(...))`).
 */
export function extractSegmentsFromScript(source: string): unknown[] {
  const segments: unknown[] = [];
  PUSH_RE.lastIndex = 0;
  for (let m = PUSH_RE.exec(source); m; m = PUSH_RE.exec(source)) {
    const start = m.index + m[0].length;
    const end = findJsonArrayEnd(source, start);
    if (end < 0) continue;
    try {
      segments.push(JSON.parse(source.slice(start, end)));
    } catch {
      // ignore malformed segment
    }
    PUSH_RE.lastIndex = end;
  }
  return segments;
}

/** Find the end (exclusive) of the JSON array starting at `start`. */
function findJsonArrayEnd(src: string, start: number): number {
  if (src[start] !== '[') return -1;
  let depth = 0;
  let inString = false;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}
