import { useEffect, useMemo, useRef, useState } from 'react';
import type { PanelActions } from './platform';
import type { TextRange } from './search/matchers';
import { textLines } from './search/text-lines';
export function RawView({
  raw,
  actions,
  ranges,
  current,
  query,
  caseSensitive,
  matchingOnly,
}: {
  raw: string;
  actions: PanelActions;
  ranges: TextRange[];
  current: number;
  query: string;
  caseSensitive: boolean;
  matchingOnly: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const [lineOffset, setLineOffset] = useState(0);
  const [copied, setCopied] = useState(false);
  const active = useRef<HTMLElement>(null);
  const size = ranges.length > 2000 ? 4000 : 40000;
  const match = ranges[current];
  useEffect(() => {
    setOffset(match ? Math.floor(match.start / size) * size : 0);
  }, [match, size]);
  const end = Math.max(
    offset + size,
    match && match.start >= offset && match.start < offset + size ? match.end : 0,
  );
  const filtered = Boolean(query && matchingOnly);
  const lines = useMemo(() => textLines(raw, ranges, filtered), [raw, ranges, filtered]);
  const selectedLine = match
    ? lines.findIndex((line) => line.start <= match.start && line.end >= match.start)
    : -1;
  useEffect(() => {
    setLineOffset(selectedLine < 0 ? 0 : Math.floor(selectedLine / 200) * 200);
  }, [selectedLine]);
  const shownLines = filtered
    ? lines.slice(lineOffset, lineOffset + 200)
    : lines.filter((line) => line.start < end && line.end >= offset);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Pagination mounts a new mark before scrolling.
  useEffect(() => {
    active.current?.scrollIntoView({ block: 'center' });
  }, [match, offset, lineOffset, caseSensitive, query, filtered]);
  const copy = () => {
    void actions
      .copy(raw)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  };
  return (
    <>
      <div className="section-tools">
        <button type="button" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" onClick={() => actions.download(raw, 'payload.txt')}>
          Download .txt
        </button>
      </div>
      <div className="pagination">
        <button
          type="button"
          disabled={filtered ? lineOffset === 0 : offset === 0}
          onClick={() =>
            filtered
              ? setLineOffset(Math.max(0, lineOffset - 200))
              : setOffset(Math.max(0, offset - size))
          }
        >
          Previous
        </button>
        <span>
          {filtered
            ? `Matching lines ${lines.length ? lineOffset + 1 : 0}–${Math.min(lines.length, lineOffset + 200)} / ${lines.length}`
            : `Characters ${offset.toLocaleString()}–${Math.min(raw.length, end).toLocaleString()} / ${raw.length.toLocaleString()}`}
        </span>
        <button
          type="button"
          disabled={filtered ? lineOffset + 200 >= lines.length : offset + size >= raw.length}
          onClick={() => (filtered ? setLineOffset(lineOffset + 200) : setOffset(offset + size))}
        >
          {filtered ? 'Next 200 lines' : `Next ${size / 1000}K`}
        </button>
      </div>
      <pre className="raw">
        {shownLines.map((line, index) => {
          const anchor = line.ranges.includes(match ?? { start: -1, end: -1 })
            ? match
            : line.ranges[0];
          const snippetStart =
            filtered && anchor ? Math.max(line.start, anchor.start - 100) : line.start;
          let position = filtered ? snippetStart : Math.max(offset, line.start);
          const lineEnd = filtered
            ? Math.min(line.end, Math.max(snippetStart + 4000, anchor?.end ?? 0))
            : Math.min(line.end, end);
          return (
            <span key={line.number}>
              {filtered &&
                index > 0 &&
                line.number !== (shownLines[index - 1]?.number ?? 0) + 1 && (
                  <span className="raw-separator" aria-hidden="true">
                    ⋯
                  </span>
                )}
              <span className="raw-line" data-line-number={line.number}>
                {filtered && (
                  <span className="raw-line-number" aria-hidden="true">
                    {line.number}
                  </span>
                )}
                {line.ranges
                  .filter((range) => range.end > position && range.start < lineEnd)
                  .map((range) => {
                    const start = Math.max(position, range.start);
                    const before = raw.slice(position, start);
                    position = Math.min(range.end, lineEnd);
                    const selected = range === match;
                    return (
                      <span key={range.start}>
                        {before}
                        <mark
                          ref={selected ? active : undefined}
                          className={selected ? 'current-match' : ''}
                          data-search-current={selected ? 'true' : undefined}
                        >
                          {raw.slice(start, position)}
                        </mark>
                      </span>
                    );
                  })}
                {raw.slice(position, lineEnd)}
              </span>
            </span>
          );
        })}
      </pre>
    </>
  );
}
