import type { TextRange } from './matchers';

export interface TextLine {
  number: number;
  start: number;
  end: number;
  ranges: TextRange[];
}

/** Retain original offsets and numbers so filtering never changes match navigation. */
export function textLines(
  raw: string,
  ranges: readonly TextRange[],
  matchingOnly: boolean,
): TextLine[] {
  const lines: TextLine[] = [];
  let start = 0;
  let number = 1;
  let index = 0;
  while (start <= raw.length) {
    const newline = raw.indexOf('\n', start);
    const end = newline === -1 ? raw.length : newline;
    while (ranges[index] && (ranges[index]?.end ?? 0) <= start) index++;
    const hits: TextRange[] = [];
    for (let next = index; ranges[next] && (ranges[next]?.start ?? end) < end; next++) {
      const range = ranges[next];
      if (range && range.end > start) hits.push(range);
    }
    if (!matchingOnly || hits.length) lines.push({ number, start, end, ranges: hits });
    if (newline === -1) break;
    start = newline + 1;
    number++;
  }
  return lines;
}
