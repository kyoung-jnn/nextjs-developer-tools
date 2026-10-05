import { type FlightValue, isElement, isRef, isSpecial } from '@nextjs-devtools/flight-parser';
import { useEffect, useMemo, useState } from 'react';
import { formatTime } from '../shared/settings';
import { filterTree, type TreeFilter } from './search/filterTree';
import { pathKey, searchText } from './search/matchers';
import { Highlight, useSearchScope } from './search/useSearch';
import { usePanelSettings } from './settingsContext';

interface Props {
  value: unknown;
  onRef?: (id: number) => void;
  depth?: number;
  name?: string;
  expandDepth?: number;
  path?: string[];
  treeFilter?: TreeFilter;
  bypassFilter?: boolean;
  ancestorValues?: readonly object[];
}
export function JsonTree({
  value,
  onRef,
  depth = 0,
  name,
  expandDepth: requestedDepth,
  path,
  treeFilter,
  bypassFilter = false,
  ancestorValues = [],
}: Props) {
  const settings = usePanelSettings();
  const expandDepth = requestedDepth ?? settings.jsonExpandDepth;
  const [open, setOpen] = useState(depth < expandDepth);
  useEffect(() => {
    setOpen(depth < expandDepth);
  }, [depth, expandDepth]);
  const [limit, setLimit] = useState(100);
  const [textLimit, setTextLimit] = useState(500);
  const search = useSearchScope();
  const searchable = path !== undefined && Boolean(search?.query);
  const filtering =
    path !== undefined && Boolean(search?.query && search.matchingOnly) && !bypassFilter;
  const [reveal, setReveal] = useState<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Changing the query permanently resets this container override.
  useEffect(() => {
    setReveal(null);
  }, [search?.query]);
  const revealed = reveal === search?.query;
  const computedFilter = useMemo(() => {
    if (treeFilter || !filtering || !path || !search) return treeFilter;
    const matches: string[][] = [];
    const keyMatches: string[][] = [];
    const globalMatches = new Set(search.paths);
    if (search.current) globalMatches.add(search.current);
    for (const encoded of globalMatches) {
      const full: string[] = JSON.parse(encoded);
      if (full.length < path.length || !path.every((segment, index) => full[index] === segment))
        continue;
      const relative = full.slice(path.length);
      matches.push(relative);
      const key = relative.at(-1) ?? name;
      if (
        key !== undefined &&
        searchText(key, search.query, { caseSensitive: search.caseSensitive, budget: 1 }).length
      )
        keyMatches.push(relative);
    }
    const local = filterTree(value, matches, keyMatches);
    return {
      visible: new Set(
        [...local.visible].map((encoded) => pathKey([...path, ...JSON.parse(encoded)])),
      ),
      hiddenCounts: new Map(
        [...local.hiddenCounts].map(([encoded, count]) => [
          pathKey([...path, ...JSON.parse(encoded)]),
          count,
        ]),
      ),
      limited: local.limited,
    };
  }, [treeFilter, filtering, path, search, value, name]);

  const id = path === undefined ? '' : pathKey(path);
  const matched = searchable && search?.paths.has(id);
  const forced =
    searchable &&
    ((search?.visibleAncestors ?? search?.ancestors)?.has(id) ||
      (filtering && computedFilter?.visible.has(id)));
  const expanded = forced || open;
  const attributes = {
    'data-search-current': matched && search?.current === id ? 'true' : undefined,
  };
  const highlight = (text: string) => (matched ? <Highlight text={text} path={path} /> : text);
  const prefix =
    name === undefined ? null : (
      <span className="json-key">{highlight(JSON.stringify(name))}: </span>
    );
  if (isRef(value))
    return (
      <div className="json-line" {...attributes}>
        {prefix}
        <button className="ref" type="button" onClick={() => onRef?.(value.id)}>
          {highlight(value.raw)}
        </button>
      </div>
    );
  if (isSpecial(value))
    return (
      <div className="json-line" {...attributes}>
        {prefix}
        <span className="special">
          {highlight(
            `${value.kind === 'date' ? 'Date' : value.kind === 'symbol' ? 'Symbol' : value.kind}${value.value === undefined ? '' : `(${value.kind === 'date' && typeof value.value === 'string' && Number.isFinite(Date.parse(value.value)) ? formatTime(Date.parse(value.value), settings.timeFormat) : value.value})`}`,
          )}
        </span>
      </div>
    );
  if (value === null || typeof value !== 'object') {
    const text = typeof value === 'string' ? JSON.stringify(value) : String(value);
    const hit =
      matched && search
        ? searchText(text, search.query, { caseSensitive: search.caseSensitive, budget: 1 })[0]
        : undefined;
    const start = hit && hit.start > textLimit - 100 ? Math.max(0, hit.start - 100) : 0;
    const shown = text.slice(start, Math.max(start + textLimit, hit?.end ?? 0));
    return (
      <div className="json-line" {...attributes}>
        {prefix}
        <span className={typeof value === 'string' ? 'json-string' : 'json-scalar'}>
          {start > 0 ? '…' : ''}
          {highlight(shown)}
          {start + shown.length < text.length && matched ? '…' : ''}
        </span>
        {text.length > textLimit && textLimit < 20000 && (
          <button type="button" onClick={() => setTextLimit(Math.min(20000, textLimit + 4000))}>
            Show more string
          </button>
        )}
        {text.length > 20000 && textLimit >= 20000 && (
          <span className="muted"> See Raw for the full string.</span>
        )}
      </div>
    );
  }
  if (ancestorValues.includes(value)) return <div className="special">{prefix}(circular)</div>;
  if (depth >= 30 && !forced) return <div className="special">{prefix}(depth limit)</div>;
  const object = isElement(value)
    ? { type: value.type, key: value.key, props: value.props, extra: value.extra }
    : value;
  const array = Array.isArray(object);
  const entries = Object.entries(object as Record<string, FlightValue>);
  const visibleEntries =
    filtering && !revealed && computedFilter
      ? entries.filter(([key]) => computedFilter.visible.has(pathKey([...(path ?? []), key])))
      : entries;
  const hidden = filtering && !revealed ? (computedFilter?.hiddenCounts.get(id) ?? 0) : 0;
  return (
    <div className="json-node">
      <button type="button" className="disclosure" {...attributes} onClick={() => setOpen(!open)}>
        {expanded ? '▾' : '▸'} {prefix}
        <span className="special">
          {array ? `Array(${entries.length})` : `Object {${entries.length}}`}
        </span>
      </button>
      {expanded && (
        <div className="nested">
          {visibleEntries
            .filter(
              ([key], index) =>
                index < limit ||
                (searchable &&
                  (search?.visibleAncestors ?? search?.ancestors)?.has(
                    pathKey([...(path ?? []), key]),
                  )),
            )
            .map(([key, child]) => (
              <JsonTree
                key={key}
                name={key}
                value={child}
                depth={depth + 1}
                onRef={onRef}
                expandDepth={expandDepth}
                path={path === undefined ? undefined : [...path, key]}
                treeFilter={computedFilter}
                ancestorValues={[...ancestorValues, value]}
                bypassFilter={
                  bypassFilter ||
                  (revealed &&
                    Boolean(
                      computedFilter &&
                        !computedFilter.visible.has(pathKey([...(path ?? []), key])),
                    ))
                }
              />
            ))}
          {hidden > 0 && (
            <button
              className="muted"
              type="button"
              onClick={() => setReveal(search?.query ?? null)}
            >
              … {hidden} hidden
            </button>
          )}
          {visibleEntries.length > limit && (
            <button type="button" onClick={() => setLimit(limit + 100)}>
              Show 100 more ({visibleEntries.length - limit} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
