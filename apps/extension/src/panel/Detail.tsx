import { deref, type FlightValue } from '@nextjs-devtools/flight-parser';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { formatTime } from '../shared/settings';
import { JsonTree } from './JsonTree';
import type { ParsedRecord } from './parse';
import type { PanelActions } from './platform';
import { groupClients, propsPreview, serverComponents } from './presentation';
import { RawView } from './RawView';
import { RenderTree } from './RenderTree';
import { ServerData } from './ServerData';
import { ancestorPaths, pathKey, searchRows, searchText } from './search/matchers';
import { searchProps } from './search/props';
import { searchShortcut } from './search/shortcut';
import {
  hasHeaderTables,
  LOG_LIMITS,
  logRowValue,
  nextResponseMetadata,
  pagesMetaValue,
  requestFields,
  searchLogs,
  searchMeta,
  searchTree,
} from './search/tabs';
import {
  revealedBySearch,
  SearchBar,
  SearchField,
  SearchScope,
  type SearchState,
  SearchText,
  shownInSearch,
  useSearchScope,
} from './search/useSearch';
import { usePanelSettings } from './settingsContext';
import type { PanelRecord } from './store';
import { logTabLabel, type PanelTab, tabsForRecord } from './tabs';
export const NOTICE =
  'The browser can only inspect data serialized from the server to the client. Server-side database and external API responses are visible only when included in the RSC payload or pageProps.';
interface Props {
  record: PanelRecord;
  search: SearchState;
  parsed: ParsedRecord | null;
  parsing: boolean;
  actions: PanelActions;
  tab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  parseError?: string | null;
  mode?: 'development' | 'production';
}
function Headers({ record }: { record: PanelRecord }) {
  const scope = useSearchScope();
  if (!hasHeaderTables(record))
    return <p className="notice">HTTP headers: n/a for the initial document.</p>;
  return (
    <>
      {(['requestHeaders', 'responseHeaders'] as const).map((key) => (
        <section key={key}>
          <h3>{key === 'requestHeaders' ? 'Request' : 'Response'} headers</h3>
          <table className="fields">
            <tbody>
              {Object.entries(record[key])
                .filter(([name]) => shownInSearch(scope, ['meta', key, name]))
                .map(([name, value]) => (
                  <tr
                    key={name}
                    className={
                      name.toLowerCase().startsWith('x-nextjs-') ? 'next-header' : undefined
                    }
                  >
                    <th>
                      <SearchText text={name} path={['meta', key, name, 'name']} />
                    </th>
                    <td>
                      <SearchText text={value} path={['meta', key, name, 'value']} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {Object.keys(record[key]).length === 0 && <p className="muted">No headers</p>}
        </section>
      ))}
    </>
  );
}
function RequestMetadata({ record }: { record: PanelRecord }) {
  const settings = usePanelSettings();
  const scope = useSearchScope();
  return (
    <section className="request-metadata">
      <h2>Request</h2>
      <table className="fields">
        <tbody>
          {requestFields(record, (ms) => formatTime(ms, settings.timeFormat))
            .filter(([label]) => shownInSearch(scope, ['meta', 'request', label]))
            .map(([label, value]) => (
              <tr key={label}>
                <th>
                  <SearchText text={label} path={['meta', 'request', label, 'label']} />
                </th>
                <td>
                  <SearchText text={value} path={['meta', 'request', label, 'value']} />
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      <Headers record={record} />
    </section>
  );
}
function Copy({ value, actions }: { value: unknown; actions: PanelActions }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void actions
          .copy(JSON.stringify(value, null, 2))
          .then(() => setCopied(true))
          .catch(() => setCopied(false));
      }}
    >
      {copied ? 'Copied' : 'Copy props'}
    </button>
  );
}
export function Detail({
  record,
  parsed,
  parsing,
  actions,
  tab,
  onTabChange: setTab,
  parseError,
  mode,
  search,
}: Props) {
  const settings = usePanelSettings();
  const pages = record.kind === 'pages-document' || record.kind === 'pages-data';
  const tabs = tabsForRecord(record.kind);
  const [rawMode, setRawMode] = useState<'Rows' | 'Text'>('Rows');
  const selectedRow = useRef<HTMLTableRowElement>(null);
  const [full, setFull] = useState(false);
  const [fragments, setFragments] = useState(settings.showFragments);
  useEffect(() => {
    setFragments(settings.showFragments);
  }, [settings.showFragments]);
  const [rowIndex, setRowIndex] = useState<number | null>(null);
  const [rowPage, setRowPage] = useState(0);
  const detail = useRef<HTMLDivElement>(null);
  const raw =
    parsed?.type === 'pages' && !parsed.error
      ? JSON.stringify(parsed.pages.raw, null, 2)
      : (parsed?.raw ?? '');
  const matches = useMemo(() => {
    const options = {
      caseSensitive: search.caseSensitive,
      formatDate: (value: string) =>
        Number.isFinite(Date.parse(value))
          ? formatTime(Date.parse(value), settings.timeFormat)
          : value,
    };
    if (tab === 'Props')
      return searchProps(
        parsed,
        search.query,
        search.caseSensitive,
        record.kind === 'action',
        options.formatDate,
      );
    if (tab === 'Meta')
      return searchMeta(parsed, record, search.query, {
        ...options,
        formatStart: (ms: number) => formatTime(ms, settings.timeFormat),
      });
    if (tab === 'Logs' && parsed?.type === 'flight')
      return searchLogs(parsed.payload, search.query, options);
    if (tab === 'Tree' && parsed?.type === 'flight')
      return searchTree(full ? parsed.fullTree : parsed.tree, search.query, {
        ...options,
        renderMode: !full,
        fragments,
      });
    if (tab === 'Raw' && (pages || rawMode === 'Text')) {
      const ranges = searchText(raw, search.query, options);
      return {
        paths: ranges.map((range) => ['text', String(range.start)]),
        ranges,
        limited: ranges.length >= 200000,
      };
    }
    const indices =
      tab === 'Raw' && parsed?.type === 'flight'
        ? searchRows(parsed.payload.rows, search.query, options)
        : [];
    return { paths: indices.map((index) => ['rows', String(index)]), indices, limited: false };
  }, [
    tab,
    parsed,
    search.query,
    search.caseSensitive,
    record,
    pages,
    rawMode,
    raw,
    settings.timeFormat,
    full,
    fragments,
  ]);
  const count = matches.paths.length;
  const current = count ? ((search.index % count) + count) % count : 0;
  const currentPath = matches.paths[current];
  const matchWindow = tab === 'Props' && count > 1000 ? Math.floor(current / 250) * 250 : 0;
  const renderedPaths = useMemo(
    () =>
      tab === 'Props' && count > 1000
        ? matches.paths.slice(matchWindow, matchWindow + 250)
        : matches.paths,
    [tab, count, matches, matchWindow],
  );
  const allPaths = useMemo(
    () => ({ paths: new Set(matches.paths.map(pathKey)), ancestors: ancestorPaths(matches.paths) }),
    [matches],
  );
  const visibleAncestors = useMemo(() => ancestorPaths(renderedPaths), [renderedPaths]);
  const scope = useMemo(
    () => ({
      query: search.query,
      caseSensitive: search.caseSensitive,
      matchingOnly: search.matchingOnly,
      ...allPaths,
      visibleAncestors,
      current: currentPath ? pathKey(currentPath) : undefined,
    }),
    [
      search.query,
      search.caseSensitive,
      search.matchingOnly,
      allPaths,
      visibleAncestors,
      currentPath,
    ],
  );
  const rowMatches = 'indices' in matches ? (matches.indices ?? []) : [];
  const rows = parsed?.type === 'flight' ? parsed.payload.rows : [];
  const visibleIndices = useMemo(
    () => (search.query && search.matchingOnly ? rowMatches : rows.map((_, index) => index)),
    [search.query, search.matchingOnly, rowMatches, rows],
  );
  const currentRow = currentPath?.[0] === 'rows' ? Number(currentPath[1]) : null;
  useEffect(() => {
    if (currentRow !== null) {
      setRowPage(Math.max(0, Math.floor(visibleIndices.indexOf(currentRow) / 200)));
      setRowIndex(currentRow);
    } else setRowPage(0);
  }, [currentRow, visibleIndices]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Scroll after the matching DOM or its pagination changes.
  useEffect(() => {
    detail.current
      ?.querySelector('[data-search-current="true"]')
      ?.scrollIntoView({ block: 'center' });
  }, [scope.current, tab, parsed, rowPage, rawMode]);
  const selectRow = (index: number): void => {
    setTab('Raw');
    setRawMode('Rows');
    search.setMatchingOnly(false);
    setRowIndex(index);
    if (index >= 0) setRowPage(Math.floor(index / 200));
  };
  const jump = (id: number): void => {
    if (parsed?.type !== 'flight') return;
    const target = parsed.payload.chunks.get(id);
    const index = target
      ? parsed.payload.rows.indexOf(target)
      : parsed.payload.rows.findIndex((row) => row.id === id);
    selectRow(index);
  };
  useEffect(() => {
    if (tab === 'Raw' && rawMode === 'Rows' && rowIndex !== null)
      selectedRow.current?.scrollIntoView({ block: 'nearest' });
  }, [tab, rawMode, rowIndex]);
  const json = (value: unknown, path?: string[]) => (
    <JsonTree value={value} onRef={jump} path={path} />
  );
  let content: ReactNode = null;
  if (parseError) content = <p className="error">{parseError}</p>;
  else if (!parsed)
    content = (
      <p className="notice">{parsing ? 'Parsing payload…' : 'Waiting for response bytes…'}</p>
    );
  else if (tab === 'Raw' && (pages || rawMode === 'Text'))
    content = (
      <RawView
        raw={
          parsed.type === 'pages' && !parsed.error
            ? JSON.stringify(parsed.pages.raw, null, 2)
            : parsed.raw
        }
        actions={actions}
        query={search.query}
        caseSensitive={search.caseSensitive}
        matchingOnly={search.matchingOnly}
        ranges={'ranges' in matches ? (matches.ranges ?? []) : []}
        current={current}
      />
    );
  else if (parsed.type === 'pages')
    content =
      tab === 'Props' ? (
        <>
          <ServerData entries={parsed.serverData} actions={actions} onRef={jump} />
          <h2>pageProps</h2>
          {parsed.error ? (
            <p className="error">{parsed.error}</p>
          ) : (
            <JsonTree value={parsed.pages.pageProps} onRef={jump} path={['pageProps']} />
          )}
        </>
      ) : (
        <>
          <h2>Next.js</h2>
          {json(pagesMetaValue(parsed), ['meta', 'pages'])}
          <RequestMetadata record={record} />
          <p className="notice">{NOTICE}</p>
        </>
      );
  else if (tab === 'Tree')
    content = (
      <>
        <div className="section-tools">
          <label>
            <input
              type="checkbox"
              checked={full}
              onChange={(event) => setFull(event.target.checked)}
            />{' '}
            Full payload
          </label>
          <label>
            <input
              type="checkbox"
              checked={fragments}
              onChange={(event) => setFragments(event.target.checked)}
            />{' '}
            Show fragments
          </label>
          <span className="muted">Click a node to inspect props</span>
        </div>
        <RenderTree
          key={`${full}:${fragments}`}
          node={full ? parsed.fullTree : parsed.tree}
          onRef={jump}
          fragments={fragments}
          renderMode={!full}
          path={['tree']}
        />
      </>
    );
  else if (tab === 'Props')
    content = (
      <>
        <ServerData entries={parsed.serverData} actions={actions} onRef={jump} />
        {mode !== 'development' &&
          !parsed.serverData.some((entry) => entry.source === 'server-io') && (
            <p className="muted">
              In production, server-side fetch results reach the browser only when they are passed
              to Client Components. Run <code>next dev</code> to see every server fetch with its
              response body under Server data.
            </p>
          )}
        <p className="muted">
          Client component props: what Server Components passed to Client Components.
        </p>
        {record.kind === 'action' && (
          <section>
            <h2>Action result</h2>
            <JsonTree
              value={deref(
                parsed.payload,
                parsed.next.fields.find((field) => field.key === 'a')?.value,
              )}
              onRef={jump}
              path={['action']}
            />
          </section>
        )}
        <h2>Client component props</h2>
        {parsed.clients.length ? (
          <ClientData clients={parsed.clients} actions={actions} onRef={jump} />
        ) : (
          <p className="notice">No client component props in this payload.</p>
        )}
        {parsed.clients.length > 100 && (
          <p className="notice">
            Showing the first 100 client components. Inspect Raw → Rows or Text for the complete
            payload.
          </p>
        )}
      </>
    );
  else if (tab === 'Meta')
    content = (
      <>
        <h2>Next.js · {parsed.next.format} payload</h2>
        {parsed.next.buildId && shownInSearch(scope, ['meta', 'buildId']) && (
          <p>
            Build:{' '}
            <code>
              <SearchText text={parsed.next.buildId} path={['meta', 'buildId']} />
            </code>
          </p>
        )}
        {parsed.next.canonicalUrl && shownInSearch(scope, ['meta', 'canonical']) && (
          <p>
            Canonical URL:{' '}
            <code>
              <SearchText text={parsed.next.canonicalUrl} path={['meta', 'canonical']} />
            </code>
          </p>
        )}
        {parsed.next.routeTree && shownInSearch(scope, ['meta', 'route']) && (
          <section>
            <h3>Route tree</h3>
            {json(parsed.next.routeTree, ['meta', 'route'])}
          </section>
        )}
        <table className="fields">
          <tbody>
            {parsed.next.fields
              .filter((field) => shownInSearch(scope, ['meta', 'field', field.key]))
              .map((field) => (
                <tr key={field.key}>
                  <th>
                    <SearchText text={field.label} path={['meta', 'field', field.key, 'label']} />
                    <small>
                      <SearchText text={field.key} path={['meta', 'field', field.key, 'key']} />
                    </small>
                  </th>
                  <td>{json(field.value, ['meta', 'field', field.key, 'value'])}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {record.formState !== undefined && shownInSearch(scope, ['meta', 'formState']) && (
          <section>
            <h3>Form state</h3>
            {json(record.formState, ['meta', 'formState'])}
          </section>
        )}
        {shownInSearch(scope, ['meta', 'nextHeaders']) && (
          <>
            <h3>Next response metadata</h3>
            {json(nextResponseMetadata(record), ['meta', 'nextHeaders'])}
          </>
        )}
        <RequestMetadata record={record} />
        <p className="notice">{NOTICE}</p>
      </>
    );
  else if (tab === 'Logs') {
    const payload = parsed.payload;
    content = (
      <>
        <p className="log-source">
          Source:{' '}
          <strong>{parsed.logSource === 'none' ? 'None (production)' : parsed.logSource}</strong>
          {record.requestId && !record.debugDone && <span className="streaming"> · Receiving</span>}
        </p>
        {record.kind === 'document' &&
          record.requestId &&
          record.done &&
          record.debugChunks.length === 0 &&
          !payload.console.length && (
            <p className="notice">Page restored from cache — reload to capture server logs</p>
          )}
        {!payload.console.length && !payload.debug.length && !payload.io.length && (
          <p className="notice">
            Server logs and debug information are included in Flight only in development mode (`next
            dev`).
          </p>
        )}
        {payload.console.slice(0, LOG_LIMITS.console).map((entry, index) => {
          const path = ['logs', 'console', String(index)];
          if (!shownInSearch(scope, path)) return null;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: Console entries have immutable stream positions and may share row IDs.
            <section className={`log ${entry.method}`} key={`console:${index}`}>
              <div>
                <strong>
                  <SearchText text={entry.method} path={[...path, 'method']} />
                </strong>{' '}
                <span className="env-badge">
                  <SearchText text={entry.env} path={[...path, 'env']} />
                </span>{' '}
                <button
                  className="ref"
                  type="button"
                  onClick={() =>
                    selectRow(
                      payload.rows.findIndex(
                        (row) =>
                          row ===
                          payload.rows.filter((candidate) => candidate.kind === 'console')[index],
                      ),
                    )
                  }
                >
                  #{entry.rowId.toString(16)}
                </button>
              </div>
              {json(entry.args, [...path, 'args'])}
              <details open={revealedBySearch(scope, [...path, 'stack']) || undefined}>
                <summary>Stack / owner</summary>
                {json({ stack: entry.stack, owner: entry.owner }, [...path, 'stack'])}
              </details>
            </section>
          );
        })}
        {(['errors', 'io'] as const).map((kind) => (
          <section key={kind}>
            <h3>
              {kind === 'errors' ? 'Errors (E)' : 'Async I/O (J)'} · {payload[kind].length}
            </h3>
            {payload[kind].slice(0, LOG_LIMITS.rows).map((row, index) =>
              shownInSearch(scope, ['logs', kind, String(index)]) ? (
                <div
                  className={`log ${kind === 'errors' ? 'error' : ''}`}
                  // biome-ignore lint/suspicious/noArrayIndexKey: Debug rows may repeat an ID; stream order is stable.
                  key={`${row.id}:${index}`}
                >
                  <button
                    type="button"
                    className="ref"
                    onClick={() => selectRow(payload.rows.indexOf(row))}
                  >
                    #{row.id.toString(16)}
                  </button>
                  {json(logRowValue(payload, row), ['logs', kind, String(index)])}
                </div>
              ) : null,
            )}
          </section>
        ))}
        <h3>Server components · {serverComponents(payload).length}</h3>
        <table className="fields server-components">
          <thead>
            <tr>
              <th>Name</th>
              <th>Env</th>
              <th>Key</th>
              <th>Relative time</th>
              <th>Props preview</th>
            </tr>
          </thead>
          <tbody>
            {serverComponents(payload)
              .slice(0, LOG_LIMITS.components)
              .filter((component) =>
                shownInSearch(scope, ['logs', 'components', String(component.id)]),
              )
              .map((component) => {
                const path = ['logs', 'components', String(component.id)];
                return (
                  <tr key={component.id}>
                    <td>
                      <button className="ref" type="button" onClick={() => jump(component.id)}>
                        <SearchText text={component.name} path={[...path, 'name']} />
                      </button>
                    </td>
                    <td>
                      <SearchText text={component.env} path={[...path, 'env']} />
                    </td>
                    <td>
                      <SearchText text={String(component.key ?? '—')} path={[...path, 'key']} />
                    </td>
                    <td>
                      {component.duration === null ? '—' : `${component.duration.toFixed(2)} ms`}
                    </td>
                    <td>
                      <details open={revealedBySearch(scope, [...path, 'props']) || undefined}>
                        <summary>{propsPreview(component.props)}</summary>
                        {json(component.props, [...path, 'props'])}
                      </details>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        <details open={revealedBySearch(scope, ['logs', 'debug']) || undefined}>
          <summary>Raw debug rows · {payload.debug.length}</summary>
          {payload.debug.slice(0, LOG_LIMITS.debug).map((row, index) =>
            shownInSearch(scope, ['logs', 'debug', String(index)]) ? (
              <div
                key={
                  // biome-ignore lint/suspicious/noArrayIndexKey: Flight debug rows can repeat IDs; stream position is stable.
                  `${row.id}:${index}`
                }
                className="log"
              >
                <button
                  className="ref"
                  type="button"
                  onClick={() => selectRow(payload.rows.indexOf(row))}
                >
                  #{row.id.toString(16)}
                </button>
                {json(logRowValue(payload, row), ['logs', 'debug', String(index)])}
              </div>
            ) : null,
          )}
        </details>
      </>
    );
  } else if (tab === 'Raw') {
    const selected = rowIndex === null ? undefined : rows[rowIndex];
    content = (
      <>
        <div className="pagination">
          <button type="button" disabled={rowPage === 0} onClick={() => setRowPage(rowPage - 1)}>
            Previous
          </button>
          <span>
            {visibleIndices.length} rows · page {rowPage + 1} /{' '}
            {Math.max(1, Math.ceil(visibleIndices.length / 200))}
          </span>
          <button
            type="button"
            disabled={(rowPage + 1) * 200 >= visibleIndices.length}
            onClick={() => setRowPage(rowPage + 1)}
          >
            Next 200
          </button>
        </div>
        <table className="rows">
          <thead>
            <tr>
              <th>id</th>
              <th>tag</th>
              <th>kind</th>
              <th>size</th>
              <th>preview</th>
            </tr>
          </thead>
          <tbody>
            {visibleIndices.slice(rowPage * 200, (rowPage + 1) * 200).map((index) => {
              const row = rows[index];
              if (!row) return null;
              const matching = rowMatches.includes(index);
              return (
                <tr
                  key={index}
                  className={`${index === rowIndex ? 'selected' : ''} ${matching ? 'search-row' : ''}`}
                  data-search-current={currentRow === index ? 'true' : undefined}
                  ref={index === rowIndex ? selectedRow : undefined}
                >
                  <td>
                    <button type="button" className="ref" onClick={() => setRowIndex(index)}>
                      <SearchField text={row.id.toString(16)} path={['rows', String(index)]} />
                    </button>
                  </td>
                  <td>
                    <SearchField text={row.tag || '—'} path={['rows', String(index)]} />
                  </td>
                  <td>
                    <SearchField text={row.kind} path={['rows', String(index)]} />
                  </td>
                  <td>{row.byteLength} B</td>
                  <td className="row-preview">
                    <SearchField
                      text={
                        matching
                          ? row.text.slice(
                              Math.max(
                                0,
                                (search.caseSensitive ? row.text : row.text.toLowerCase()).indexOf(
                                  search.caseSensitive ? search.query : search.query.toLowerCase(),
                                ) - 40,
                              ),
                              Math.max(
                                120,
                                (search.caseSensitive ? row.text : row.text.toLowerCase()).indexOf(
                                  search.caseSensitive ? search.query : search.query.toLowerCase(),
                                ) +
                                  search.query.length +
                                  40,
                              ),
                            )
                          : row.text.slice(0, 120)
                      }
                      path={['rows', String(index)]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {selected && (
          <section className="card">
            <h3>
              Row {selected.id.toString(16)} · {selected.kind}
            </h3>
            {selected.parseError && <p className="error">{selected.parseError}</p>}
            {json(selected.value ?? (selected.text as FlightValue))}
          </section>
        )}
      </>
    );
  }
  return (
    <div className="detail" ref={detail}>
      <div className="detail-title">
        <strong>{record.method}</strong> <span>{record.url}</span>
        {record.error && <span className="error">{record.error}</span>}
        {parsing && <span className="muted">Updating…</span>}
        {/* Search lives here, not in the tab strip, so it never reads as a tab (10-search §12). */}
        <button
          type="button"
          className="search-trigger toggle-button"
          aria-label="Search"
          aria-pressed={search.open}
          title={`${search.open ? 'Close search' : 'Search'} (${searchShortcut()})`}
          onClick={search.toggle}
        >
          <span aria-hidden="true">🔍</span> Search <kbd>{searchShortcut()}</kbd>
        </button>
      </div>
      <div className="tabs" role="tablist" aria-label="Payload details">
        {tabs.map((name) => (
          <button
            role="tab"
            aria-selected={tab === name}
            className={tab === name ? 'active' : ''}
            type="button"
            key={name}
            onClick={() => setTab(name)}
          >
            {name === 'Logs' && parsed?.type === 'flight'
              ? logTabLabel(parsed.payload.console.length, parsed.payload.errors.length)
              : name}
          </button>
        ))}
      </div>
      {search.open && (
        <SearchBar
          search={search}
          count={count}
          current={current}
          limited={matches.limited}
          scopeLabel={tab.toLowerCase()}
        />
      )}
      <div className="detail-content" tabIndex={-1}>
        {tab === 'Raw' && !pages && (
          <div className="section-tools">
            {(['Rows', 'Text'] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                className="toggle-button"
                aria-pressed={rawMode === mode}
                onClick={() => setRawMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        )}
        {tab === 'Props' && count > 1000 && (
          <div className="pagination">
            <button
              type="button"
              disabled={matchWindow === 0}
              onClick={() => search.move(Math.max(0, matchWindow - 250) - current)}
            >
              Previous matches
            </button>
            <span>
              Rendering matches {matchWindow + 1}–{Math.min(count, matchWindow + 250)} / {count}.
              Match navigation reveals each result.
            </span>
            <button
              type="button"
              disabled={matchWindow + 250 >= count}
              onClick={() => search.move(matchWindow + 250 - current)}
            >
              Next matches
            </button>
          </div>
        )}
        <SearchScope.Provider value={scope}>{content}</SearchScope.Provider>
      </div>
    </div>
  );
}

function ClientData({
  clients,
  actions,
  onRef,
}: {
  clients: import('@nextjs-devtools/flight-parser').ClientProps[];
  actions: PanelActions;
  onRef: (id: number) => void;
}) {
  const search = useSearchScope();
  const settings = usePanelSettings();
  const groups = groupClients(clients).filter(
    (group) =>
      !search?.query ||
      !search.matchingOnly ||
      (search.visibleAncestors ?? search.ancestors).has(pathKey(['clients', group.moduleId])),
  );
  const matching = (group: ReturnType<typeof groupClients>[number]) =>
    Boolean(
      search?.query &&
        (search.visibleAncestors ?? search.ancestors).has(pathKey(['clients', group.moduleId])),
    );
  const render = (group: ReturnType<typeof groupClients>[number]) => (
    <details
      className="card"
      key={group.moduleId}
      open={matching(group) || (!group.internal && group.instances.length === 1)}
    >
      <summary>
        <strong>
          <SearchField text={group.component} path={['clients', group.moduleId, 'component']} /> ×{' '}
          {group.instances.length}
        </strong>{' '}
        <span className="client-badge">client</span>
      </summary>
      <div className="muted module-path">
        <SearchField text={group.moduleId} path={['clients', group.moduleId, 'moduleId']} />
      </div>
      {group.instances
        .map((client, index) => ({ client, index }))
        .filter(
          ({ index }) =>
            index < 100 ||
            (search?.query &&
              (search.visibleAncestors ?? search.ancestors).has(
                pathKey(['clients', group.moduleId, 'instances', String(index)]),
              )),
        )
        .map(({ client, index }) => (
          <section key={`${group.moduleId}:${index}`}>
            <div className="card-title">
              <strong>Instance {index + 1}</strong>
              <Copy value={client.props} actions={actions} />
            </div>
            <JsonTree
              value={client.props}
              onRef={onRef}
              path={['clients', group.moduleId, 'instances', String(index)]}
            />
          </section>
        ))}
      {group.instances.length > 100 && (
        <p className="notice">
          Showing 100 instances. Inspect Raw → Rows or Text for the complete payload.
        </p>
      )}
    </details>
  );
  return (
    <>
      {groups
        .filter((group) => !group.internal)
        .filter((group, index) => index < 100 || matching(group))
        .map(render)}
      <details
        open={
          settings.expandNextInternals || groups.some((group) => group.internal && matching(group))
        }
      >
        <summary>
          Next.js internals ·{' '}
          {groups
            .filter((group) => group.internal)
            .reduce((n, group) => n + group.instances.length, 0)}
        </summary>
        {groups
          .filter((group) => group.internal)
          .filter((group, index) => index < 100 || matching(group))
          .map(render)}
      </details>
    </>
  );
}
