import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { pathKey, searchText } from './matchers';
import { matchCaseShortcut, searchShortcut } from './shortcut';
import { SEARCH_SOURCE } from './transport';

export function useSearch(
  initial = '',
  defaults?: { caseSensitive: boolean; matchingOnly: boolean },
) {
  const [input, setInput] = useState(initial);
  const [query, setQuery] = useState(initial);
  const [open, setOpen] = useState(Boolean(initial));
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matchingOnly, setMatchingOnly] = useState(true);
  const [index, setIndex] = useState(0);
  const [focus, setFocus] = useState(0);
  useEffect(() => {
    setCaseSensitive(defaults?.caseSensitive ?? false);
  }, [defaults?.caseSensitive]);
  useEffect(() => {
    setMatchingOnly(defaults?.matchingOnly ?? true);
  }, [defaults?.matchingOnly]);
  useEffect(() => {
    if (input === query) return;
    const timer = setTimeout(() => {
      setQuery(input);
      setIndex(0);
    }, 120);
    return () => clearTimeout(timer);
  }, [input, query]);
  // Search works in the current tab (docs/design/10-search.md §11); never switch tabs.
  const reveal = () => {
    setOpen(true);
    setFocus((n) => n + 1);
  };
  const close = () => {
    setInput('');
    setQuery('');
    setIndex(0);
    setOpen(false);
    document.querySelector<HTMLElement>('.detail-content')?.focus();
  };
  const toggle = () => (open ? close() : reveal());
  const move = (delta: number) => setIndex((n) => n + delta);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
        return;
      }
      if (open && event.altKey && event.code === 'KeyC') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setCaseSensitive((current) => !current);
        document.querySelector<HTMLInputElement>('.search-bar > input')?.focus();
        return;
      }
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        event.stopImmediatePropagation();
        // Toggle (10-search §13): a second Cmd/Ctrl+K closes like Escape.
        if (open) close();
        else reveal();
      } else if (open && event.key.toLowerCase() === 'g') {
        event.preventDefault();
        event.stopImmediatePropagation();
        move(event.shiftKey ? -1 : 1);
      }
    };
    const message = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.source !== SEARCH_SOURCE) return;
      const payload: unknown = event.data.payload;
      if (!payload || typeof payload !== 'object' || !('action' in payload)) return;
      switch (payload.action) {
        case 'performSearch':
          if ('query' in payload && typeof payload.query === 'string') {
            setInput(payload.query);
            setQuery(payload.query);
            setIndex(0);
            reveal();
          }
          break;
        case 'nextSearchResult':
          move(1);
          break;
        case 'previousSearchResult':
          move(-1);
          break;
        case 'cancelSearch':
          close();
          break;
      }
    };
    window.addEventListener('keydown', key, { capture: true });
    window.addEventListener('message', message);
    return () => {
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('message', message);
    };
  });
  return {
    input,
    setInput,
    query,
    open,
    caseSensitive,
    setCaseSensitive,
    matchingOnly,
    setMatchingOnly,
    index,
    focus,
    reveal,
    close,
    toggle,
    move,
  };
}
export type SearchState = ReturnType<typeof useSearch>;
export interface Scope {
  query: string;
  caseSensitive: boolean;
  matchingOnly: boolean;
  paths: Set<string>;
  ancestors: Set<string>;
  visibleAncestors?: Set<string>;
  current: string | undefined;
}
export const SearchScope = createContext<Scope | null>(null);
export const useSearchScope = () => useContext(SearchScope);
export function Highlight({ text, path }: { text: string; path?: string[] }) {
  const scope = useSearchScope();
  if (!scope?.query) return <>{text}</>;
  const ranges = searchText(text, scope.query, { caseSensitive: scope.caseSensitive });
  const current = path !== undefined && scope.current === pathKey(path);
  let offset = 0;
  return (
    <>
      {ranges.map((range) => {
        const before = text.slice(offset, range.start);
        offset = range.end;
        return (
          <span key={range.start}>
            {before}
            <mark className={current ? 'current-match' : ''}>
              {text.slice(range.start, range.end)}
            </mark>
          </span>
        );
      })}
      {text.slice(offset)}
    </>
  );
}
/** Plain text that participates in search: highlighted, and the scroll target when current. */
export function SearchText({ text, path }: { text: string; path: string[] }) {
  const scope = useSearchScope();
  const id = pathKey(path);
  if (!scope?.query || !scope.paths.has(id)) return <>{text}</>;
  return (
    <span data-search-current={scope.current === id ? 'true' : undefined}>
      <Highlight text={text} path={path} />
    </span>
  );
}
/** With "Matching only", render an item only when it contains a match (10 §8, §11). */
export function shownInSearch(scope: Scope | null, path: string[]): boolean {
  return !scope?.query || !scope.matchingOnly || scope.ancestors.has(pathKey(path));
}
/** Whether a collapsible item (details, props panel) must be open to reveal a match inside it. */
export function revealedBySearch(scope: Scope | null, path: string[]): boolean {
  return Boolean(scope?.query && scope.ancestors.has(pathKey(path)));
}
export function SearchBar({
  search,
  count,
  current,
  limited,
  scopeLabel,
}: {
  search: SearchState;
  count: number;
  current: number;
  limited: boolean;
  /** Lowercase tab name shown in the placeholder, e.g. "props", "tree", "logs". */
  scopeLabel: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: A repeated shortcut must refocus an already-open bar.
  useEffect(() => {
    if (search.open) {
      input.current?.focus();
      input.current?.select();
    }
  }, [search.open, search.focus]);
  return (
    <search
      className="search-bar"
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.stopPropagation();
      }}
    >
      <input
        ref={input}
        aria-label={`Search ${scopeLabel}`}
        placeholder={`Search ${scopeLabel} (${searchShortcut()})`}
        value={search.input}
        onChange={(e) => search.setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            search.move(e.shiftKey ? -1 : 1);
          }
        }}
      />
      <span className="search-count" aria-live="polite">
        {limited ? '200k+ · Search limited' : count ? `${current + 1} / ${count}` : 'No matches'}
      </span>
      <button
        type="button"
        aria-label="Previous match"
        disabled={!count}
        onClick={() => search.move(-1)}
      >
        ↑
      </button>
      <button
        type="button"
        aria-label="Next match"
        disabled={!count}
        onClick={() => search.move(1)}
      >
        ↓
      </button>
      <button
        type="button"
        className="toggle-button"
        aria-label="Match case"
        title={`Match case (${matchCaseShortcut()})`}
        onMouseDown={(event) => event.preventDefault()}
        aria-pressed={search.caseSensitive}
        onClick={() => {
          search.setCaseSensitive(!search.caseSensitive);
          input.current?.focus();
        }}
      >
        Aa
      </button>
      <label>
        <input
          type="checkbox"
          checked={search.matchingOnly}
          onChange={(e) => search.setMatchingOnly(e.target.checked)}
        />{' '}
        Matching only
      </label>
      <span className="search-hint">Enter ↓ · ⇧Enter ↑ · Esc close</span>
      <button type="button" aria-label="Close search" onClick={search.close}>
        ×
      </button>
    </search>
  );
}
export function SearchField({ text, path }: { text: string; path: string[] }) {
  const scope = useSearchScope();
  return (
    <span data-search-current={scope?.current === pathKey(path) ? 'true' : undefined}>
      <Highlight text={text} path={path} />
    </span>
  );
}
