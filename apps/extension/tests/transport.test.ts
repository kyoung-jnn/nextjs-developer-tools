import { describe, expect, it, vi } from 'vitest';
import { connectSearchPanel, SEARCH_SOURCE } from '../src/panel/search/transport';

function panelHarness() {
  let search: (action: string, query?: string) => void = () => {};
  let shown: (window: { postMessage(message: unknown, targetOrigin: string): void }) => void =
    () => {};
  connectSearchPanel({
    onSearch: { addListener: (listener) => (search = listener) },
    onShown: { addListener: (listener) => (shown = listener) },
  });
  return {
    search: (action: string, query?: string) => search(action, query),
    shown: (window: { postMessage(message: unknown, targetOrigin: string): void }) => shown(window),
  };
}

describe('DevTools search transport', () => {
  it('queues actions before the panel is shown and flushes them in order once', () => {
    const panel = panelHarness();
    const window = { postMessage: vi.fn() };
    panel.search('performSearch', 'nested value');
    panel.search('nextSearchResult');
    panel.search('previousSearchResult');
    panel.search('cancelSearch');
    expect(window.postMessage).not.toHaveBeenCalled();

    panel.shown(window);
    expect(window.postMessage.mock.calls).toEqual([
      [{ source: SEARCH_SOURCE, payload: { action: 'performSearch', query: 'nested value' } }, '*'],
      [{ source: SEARCH_SOURCE, payload: { action: 'nextSearchResult' } }, '*'],
      [{ source: SEARCH_SOURCE, payload: { action: 'previousSearchResult' } }, '*'],
      [{ source: SEARCH_SOURCE, payload: { action: 'cancelSearch' } }, '*'],
    ]);
    panel.shown(window);
    expect(window.postMessage).toHaveBeenCalledTimes(4);
  });

  it('sends new actions immediately to the latest shown window', () => {
    const panel = panelHarness();
    const first = { postMessage: vi.fn() };
    const latest = { postMessage: vi.fn() };
    panel.shown(first);
    panel.search('performSearch', 'first');
    panel.shown(latest);
    panel.search('performSearch', '');
    panel.search('nextSearchResult');

    expect(first.postMessage).toHaveBeenCalledTimes(1);
    expect(latest.postMessage.mock.calls).toEqual([
      [{ source: SEARCH_SOURCE, payload: { action: 'performSearch', query: '' } }, '*'],
      [{ source: SEARCH_SOURCE, payload: { action: 'nextSearchResult' } }, '*'],
    ]);
  });

  it('ignores unsupported actions before and after the panel is shown', () => {
    const panel = panelHarness();
    const window = { postMessage: vi.fn() };
    panel.search('unknownAction', 'query');
    panel.shown(window);
    panel.search('unknownAction');
    expect(window.postMessage).not.toHaveBeenCalled();
    expect(SEARCH_SOURCE).toBe('__nextjs_devtools_search__');
  });
});
