export const SEARCH_SOURCE = '__nextjs_devtools_search__';

export type SearchAction = {
  action: 'performSearch' | 'nextSearchResult' | 'previousSearchResult' | 'cancelSearch';
  query?: string;
};

interface SearchPanelWindow {
  postMessage(
    message: { source: typeof SEARCH_SOURCE; payload: SearchAction },
    targetOrigin: string,
  ): void;
}

interface SearchPanel {
  onSearch: { addListener(listener: (action: string, query?: string) => void): void };
  onShown: { addListener(listener: (window: SearchPanelWindow) => void): void };
}

/** Bridge DevTools search events to the current panel, preserving events before its first show. */
export function connectSearchPanel(panel: SearchPanel): void {
  let panelWindow: SearchPanelWindow | undefined;
  const pending: SearchAction[] = [];
  const send = (payload: SearchAction) => {
    panelWindow?.postMessage({ source: SEARCH_SOURCE, payload }, '*');
  };

  panel.onSearch.addListener((action, query) => {
    if (
      action !== 'performSearch' &&
      action !== 'nextSearchResult' &&
      action !== 'previousSearchResult' &&
      action !== 'cancelSearch'
    ) {
      return;
    }
    const payload: SearchAction = query === undefined ? { action } : { action, query };
    if (panelWindow) send(payload);
    else pending.push(payload);
  });

  panel.onShown.addListener((window) => {
    panelWindow = window;
    for (const payload of pending.splice(0)) send(payload);
  });
}
