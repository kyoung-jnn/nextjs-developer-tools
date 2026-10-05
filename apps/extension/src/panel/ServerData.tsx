import {
  isRef,
  isSpecial,
  type ServerDataEntry,
  type ServerDataSource,
} from '@nextjs-devtools/flight-parser';
import { useState } from 'react';
import { formatTime } from '../shared/settings';
import { JsonTree } from './JsonTree';
import type { PanelActions } from './platform';
import { pathKey } from './search/matchers';
import { SearchField, useSearchScope } from './search/useSearch';
import { usePanelSettings } from './settingsContext';

const labels: Record<ServerDataSource, [string, string]> = {
  'tanstack-query': ['TanStack Query', 'queries'],
  swr: ['SWR', 'keys'],
  apollo: ['Apollo', 'fields'],
  redux: ['Redux', 'states'],
  urql: ['urql', 'keys'],
  'streamed-promise': ['Streamed promises', ''],
  'server-io': ['Server fetches (dev)', ''],
};
export function serializeServerData(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item: unknown) => {
      if (isSpecial(item))
        return item.value === undefined ? item.kind : `${item.kind}(${item.value})`;
      if (isRef(item)) return item.raw;
      return item;
    },
    2,
  );
}
function DataCard({
  entry,
  actions,
  onRef,
  index,
}: {
  index: number;
  entry: ServerDataEntry;
  actions: PanelActions;
  onRef: (id: number) => void;
}) {
  const settings = usePanelSettings();
  const [copied, setCopied] = useState(false);
  const updated =
    entry.updatedAt === undefined || entry.updatedAt <= 0 ? null : new Date(entry.updatedAt);
  return (
    <section className="card server-data-card">
      <div className="card-title">
        <strong>
          <SearchField text={entry.label} path={['server', String(index), 'label']} />
        </strong>
        <button
          type="button"
          onClick={() => {
            void actions
              .copy(serializeServerData(entry.data))
              .then(() => setCopied(true))
              .catch(() => setCopied(false));
          }}
        >
          {copied ? 'Copied' : 'Copy data'}
        </button>
      </div>
      <div className="muted module-path">
        <SearchField text={entry.location} path={['server', String(index), 'location']} />
      </div>
      <p className="muted">
        {entry.status && (
          <span>
            <SearchField text={entry.status} path={['server', String(index), 'status']} />{' '}
          </span>
        )}
        {updated && !Number.isNaN(updated.getTime()) && (
          <span>Updated: {formatTime(updated.getTime(), settings.timeFormat)} </span>
        )}
        {entry.durationMs !== undefined && <span>{entry.durationMs.toFixed(2)} ms</span>}
      </p>
      {typeof entry.meta?.note === 'string' && <p className="notice">{entry.meta.note}</p>}
      <JsonTree
        value={entry.data}
        path={['server', String(index), 'data']}
        onRef={onRef}
        // Non-fetch server I/O (e.g. Next's headers()) is large and secondary: start collapsed.
        expandDepth={entry.source === 'server-io' && !entry.label.startsWith('fetch ') ? 1 : 8}
      />
      {entry.meta && (
        <details>
          <summary>Metadata</summary>
          <JsonTree value={entry.meta} onRef={onRef} />
        </details>
      )}
    </section>
  );
}
export function ServerData({
  entries,
  actions,
  onRef,
}: {
  entries: ServerDataEntry[];
  actions: PanelActions;
  onRef: (id: number) => void;
}) {
  const search = useSearchScope();
  if (!entries.length) return null;
  const groups = new Map<ServerDataSource, ServerDataEntry[]>();
  for (const [index, entry] of entries.entries()) {
    if (
      search?.query &&
      search.matchingOnly &&
      !(search.visibleAncestors ?? search.ancestors).has(pathKey(['server', String(index)]))
    )
      continue;
    const group = groups.get(entry.source);
    if (group) group.push(entry);
    else groups.set(entry.source, [entry]);
  }
  return (
    <section className="server-data">
      <h2>Server data</h2>
      {Array.from(groups, ([source, items]) => (
        <section key={source}>
          <h3>
            {labels[source][0]} · {items.length} {labels[source][1]}
          </h3>
          {items.map((entry, index) => (
            <DataCard
              // biome-ignore lint/suspicious/noArrayIndexKey: Immutable extraction positions distinguish entries with the same source and location.
              key={`${entry.location}:${index}`}
              index={entries.indexOf(entry)}
              entry={entry}
              actions={actions}
              onRef={onRef}
            />
          ))}
        </section>
      ))}
    </section>
  );
}
