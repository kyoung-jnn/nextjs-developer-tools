export interface PanelActions {
  reload(): void;
  copy(text: string): Promise<void>;
  download(text: string, name: string): void;
  theme: 'light' | 'dark';
}
export function browserActions(theme: 'light' | 'dark', reload: () => void): PanelActions {
  return {
    theme,
    reload,
    copy: async (text) => {
      await navigator.clipboard.writeText(text);
    },
    download(text, name) {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };
}
export function chromeActions(): PanelActions {
  return browserActions(chrome.devtools.panels.themeName === 'dark' ? 'dark' : 'light', () =>
    chrome.devtools.inspectedWindow.reload(),
  );
}
