import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSettings } from '../settings-ui/useSettings';
import { resolveTheme } from '../shared/settings';
import type { CaptureKind } from '../shared/types';
import { Detail, NOTICE } from './Detail';
import type { PanelActions } from './platform';
import { SettingsDrawer } from './SettingsDrawer';
import { useSearch } from './search/useSearch';
import { PanelSettings } from './settingsContext';
import type { DataSource } from './source';
import { createPanelStore, isPrefetch } from './store';
import { type PanelTab, tabForRecord } from './tabs';
import { createWorkerParser } from './workerParser';

const badges: Record<CaptureKind, string> = {
  document: 'DOC',
  navigation: 'NAV',
  prefetch: 'PREF',
  action: 'ACT',
  rsc: 'RSC',
  'pages-document': 'PAGE',
  'pages-data': 'DATA',
};
function size(bytes: number): string {
  return bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(1)} MB`
    : bytes >= 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${bytes} B`;
}
function path(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('_rsc');
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}
export function PanelApp({
  source,
  actions,
  initialRecord,
  initialTab,
  initialSearch,
}: {
  source: DataSource;
  actions: PanelActions;
  initialRecord?: string;
  initialTab?: string;
  initialSearch?: string;
}) {
  const { settings, update: updateSettings, ready, saved } = useSettings();
  const [drawer, setDrawer] = useState(false);
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const resources = useMemo(() => {
    const parser = createWorkerParser();
    return { parser, store: createPanelStore(source.snapshot(), { parse: parser.parse }) };
  }, [source]);
  const store = resources.store;
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [tab, setTab] = useState<PanelTab>(tabForRecord('document', initialTab));
  const initializedTab = useRef(false);
  const search = useSearch(initialSearch, {
    caseSensitive: settings.searchCaseSensitive,
    matchingOnly: settings.searchMatchingOnly,
  });
  useEffect(() => {
    if (ready)
      store.setOptions({ hidePrefetch: settings.hidePrefetch, preserve: settings.preserveLog });
  }, [ready, store, settings.hidePrefetch, settings.preserveLog]);
  const [width, setWidth] = useState(310);
  useEffect(() => {
    const unsubscribe = source.subscribe(store.update);
    if (initialRecord) {
      const record = store.getSnapshot().records.find((record) => record.id === initialRecord);
      if (record) store.select(record.key);
    }
    return () => {
      unsubscribe();
      store.dispose();
      resources.parser.dispose();
    };
  }, [source, store, resources, initialRecord]);
  const selected = state.records.find((record) => record.key === state.selected);
  const selectedKind = selected?.kind;
  useEffect(() => {
    if (!selectedKind || !ready) return;
    if (!initializedTab.current) {
      setTab(tabForRecord(selectedKind, initialTab ?? settings.defaultTab));
      initializedTab.current = true;
    } else setTab((current) => tabForRecord(selectedKind, current));
  }, [selectedKind, ready, initialTab, settings.defaultTab]);
  const hidden = state.records.filter(isPrefetch).length;
  const records = state.records.filter(
    (record) =>
      (!state.hidePrefetch || !isPrefetch(record)) &&
      (state.kind === 'all' ||
        (state.kind === 'prefetch'
          ? isPrefetch(record)
          : record.kind === state.kind && !isPrefetch(record))) &&
      record.url.toLowerCase().includes(state.query.toLowerCase()),
  );
  function resize(event: React.PointerEvent<HTMLHRElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  const detected = state.detection?.isNext;
  return (
    <PanelSettings.Provider value={settings}>
      <div
        className="panel-app"
        data-theme={resolveTheme(settings.theme, actions.theme)}
        data-density={settings.density}
      >
        <div className="toolbar">
          <div className="brand">
            🅝{' '}
            <strong>Next.js{state.detection?.version ? ` ${state.detection.version}` : ''}</strong>
            <span>
              {detected
                ? state.detection?.router === 'app'
                  ? 'App Router'
                  : state.detection?.router === 'pages'
                    ? 'Pages Router'
                    : 'Detected'
                : 'Not detected'}
            </span>
            {state.detection?.mode && (
              <span>{state.detection.mode === 'development' ? 'dev' : 'prod'}</span>
            )}
            {state.detection?.buildId && <code>build {state.detection.buildId}</code>}
          </div>
          <select
            aria-label="Request kind filter"
            value={state.kind}
            onChange={(event) =>
              store.setOptions({ kind: event.target.value as CaptureKind | 'all' })
            }
          >
            <option value="all">All requests</option>
            {Object.entries(badges).map(([kind, label]) => (
              <option key={kind} value={kind}>
                {label}
              </option>
            ))}
          </select>
          <input
            aria-label="Filter URL"
            placeholder="Filter URL"
            value={state.query}
            onChange={(event) => store.setOptions({ query: event.target.value })}
          />
          <label>
            <input
              type="checkbox"
              checked={state.hidePrefetch}
              onChange={(event) => {
                const hidePrefetch = event.target.checked;
                store.setOptions({ hidePrefetch });
                void updateSettings({ hidePrefetch }).catch(() => {});
              }}
            />{' '}
            Hide prefetch
          </label>
          <label>
            <input
              type="checkbox"
              checked={state.preserve}
              onChange={(event) => {
                const preserveLog = event.target.checked;
                store.setOptions({ preserve: preserveLog });
                void updateSettings({ preserveLog }).catch(() => {});
              }}
            />{' '}
            Preserve log
          </label>
          <button type="button" onClick={store.clear}>
            Clear
          </button>
          <button type="button" onClick={actions.reload}>
            Reload
          </button>
          <button
            className="settings-trigger"
            type="button"
            aria-label="Settings"
            title="Settings"
            onClick={() => setDrawer(true)}
          >
            ⚙
          </button>
        </div>
        {!state.records.length ? (
          <div className="empty">
            <h2>
              {detected
                ? 'Reload the page to capture the initial SSR response'
                : 'Next.js was not detected on this page'}
            </h2>
            <button type="button" onClick={actions.reload}>
              Reload
            </button>
            <p className="notice">{NOTICE}</p>
          </div>
        ) : (
          <div className="split">
            <aside className="requests" style={{ width }}>
              <div className="request-summary">
                {records.length} requests
                {state.hidePrefetch && hidden > 0 && <span>{hidden} prefetch hidden</span>}
              </div>
              {records.length === 0 && <p className="notice">No requests match these filters.</p>}
              {records.map((record, index) => {
                const previous = records[index - 1];
                const prefetch = isPrefetch(record);
                return (
                  <div key={record.key}>
                    {previous && previous.generation !== record.generation && (
                      <div className="navigation-separator">New document · {path(record.url)}</div>
                    )}
                    <button
                      type="button"
                      className={`request ${selected?.key === record.key ? 'selected' : ''} ${record.byteLength === 0 ? 'zero' : ''}`}
                      onClick={() => store.select(record.key)}
                      title={record.url}
                    >
                      <span className={`kind ${prefetch ? 'prefetch' : record.kind}`}>
                        {prefetch ? 'PREF' : badges[record.kind]}
                      </span>
                      <span className="request-path">
                        {path(record.url)}
                        {record.method !== 'GET' && <small>{record.method}</small>}
                      </span>
                      <span className="request-status">{record.status ?? '—'}</span>
                      <span className="request-size">{size(record.byteLength)}</span>
                      <small className="request-duration">
                        {record.done ? (
                          `${Math.max(0, (record.endTime ?? record.startTime) - record.startTime)} ms`
                        ) : (
                          <span className="streaming">● streaming</span>
                        )}
                      </small>
                    </button>
                  </div>
                );
              })}
            </aside>
            <hr
              className="splitter"
              onPointerDown={resize}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                  setWidth(Math.max(220, Math.min(600, event.clientX)));
              }}
              aria-label="Resize request list"
              aria-orientation="vertical"
              aria-valuenow={width}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft') setWidth(Math.max(220, width - 20));
                if (event.key === 'ArrowRight') setWidth(Math.min(600, width + 20));
              }}
            />
            {selected ? (
              <Detail
                key={selected.key}
                record={selected}
                parsed={state.parsed}
                parsing={state.parsing}
                parseError={state.parseError}
                actions={actions}
                tab={tabForRecord(selected.kind, tab)}
                onTabChange={setTab}
                mode={state.detection?.mode}
                search={search}
              />
            ) : (
              <div className="empty">Select a request</div>
            )}
          </div>
        )}
        {drawer && (
          <SettingsDrawer
            settings={settings}
            onChange={(patch) => {
              void updateSettings(patch).catch(() => {});
            }}
            saved={saved}
            onClose={closeDrawer}
          />
        )}
      </div>
    </PanelSettings.Provider>
  );
}
