export interface Settings {
  theme: 'system' | 'light' | 'dark';
  density: 'compact' | 'comfortable';
  timeFormat: 'relative' | 'local' | 'iso';
  defaultTab: 'Props' | 'Tree' | 'Logs' | 'Meta' | 'Raw';
  hidePrefetch: boolean;
  preserveLog: boolean;
  showFragments: boolean;
  expandNextInternals: boolean;
  jsonExpandDepth: number;
  searchCaseSensitive: boolean;
  searchMatchingOnly: boolean;
  capturePrefetch: boolean;
  maxRecordsPerTab: number;
  maxMegabytesPerTab: number;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  theme: 'system',
  density: 'compact',
  timeFormat: 'local',
  defaultTab: 'Props',
  hidePrefetch: true,
  preserveLog: false,
  showFragments: false,
  expandNextInternals: false,
  jsonExpandDepth: 3,
  searchCaseSensitive: false,
  searchMatchingOnly: true,
  capturePrefetch: true,
  maxRecordsPerTab: 300,
  maxMegabytesPerTab: 50,
});

export function normalizeSettings(value: unknown): Settings {
  const input =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const result: Settings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (typeof DEFAULT_SETTINGS[key] === 'boolean' && typeof input[key] === 'boolean')
      Object.assign(result, { [key]: input[key] });
  }
  for (const [key, choices] of Object.entries({
    theme: ['system', 'light', 'dark'],
    density: ['compact', 'comfortable'],
    timeFormat: ['relative', 'local', 'iso'],
    defaultTab: ['Props', 'Tree', 'Logs', 'Meta', 'Raw'],
  })) {
    if (typeof input[key] === 'string' && choices.includes(input[key] as string))
      Object.assign(result, { [key]: input[key] });
  }
  for (const [key, min, max] of [
    ['jsonExpandDepth', 1, 10],
    ['maxRecordsPerTab', 50, 1000],
    ['maxMegabytesPerTab', 10, 200],
  ] as const) {
    const number = input[key];
    if (typeof number === 'number' && Number.isFinite(number))
      result[key] = Math.max(min, Math.min(max, Math.round(number)));
  }
  return result;
}

const STORAGE_KEY = 'settings';
let memory: Settings = { ...DEFAULT_SETTINGS };
let saveQueue: Promise<unknown> = Promise.resolve();
const listeners = new Set<(settings: Settings) => void>();

function storageApi() {
  try {
    return typeof chrome !== 'undefined' ? chrome.storage : undefined;
  } catch {
    return undefined;
  }
}

function readFallback(): Settings {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (saved) memory = normalizeSettings(JSON.parse(saved));
  } catch {
    /* Storage can be disabled in previews. */
  }
  return { ...memory };
}

export async function loadSettings(): Promise<Settings> {
  const storage = storageApi();
  if (storage?.sync) {
    const data = await storage.sync.get(STORAGE_KEY);
    return normalizeSettings(data[STORAGE_KEY]);
  }
  return readFallback();
}

// All real extension clients write through the service worker's single queue.
export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const runtime = typeof chrome !== 'undefined' ? chrome.runtime : undefined;
  if (runtime?.sendMessage) {
    const response: unknown = await runtime.sendMessage({ type: 'save-settings', patch });
    if (!response || typeof response !== 'object' || Array.isArray(response))
      throw new Error('Could not save settings: invalid service worker response');
    if ('error' in response)
      throw new Error(
        typeof response.error === 'string' ? response.error : 'Could not save settings',
      );
    return normalizeSettings(response);
  }
  return persistSettings(patch);
}

// Direct adapter used by the service worker and previews without runtime APIs.
export function persistSettings(patch: Partial<Settings>): Promise<Settings> {
  const save = async () => {
    const next = normalizeSettings({ ...(await loadSettings()), ...patch });
    const stored = { version: 1, ...next };
    const storage = storageApi();
    if (storage?.sync) await storage.sync.set({ [STORAGE_KEY]: stored });
    else {
      memory = next;
      try {
        globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(stored));
      } catch {
        /* The in-memory store still supports previews without storage. */
      }
      for (const listener of listeners) listener({ ...next });
    }
    return next;
  };
  const result = saveQueue.then(save, save);
  saveQueue = result.catch(() => undefined);
  return result;
}

export function onSettingsChanged(callback: (settings: Settings) => void): () => void {
  const storage = storageApi();
  if (storage?.onChanged) {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'sync' && changes[STORAGE_KEY])
        callback(normalizeSettings(changes[STORAGE_KEY].newValue));
    };
    storage.onChanged.addListener(listener);
    return () => storage.onChanged.removeListener(listener);
  }
  listeners.add(callback);
  const listener = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    try {
      memory = normalizeSettings(event.newValue ? JSON.parse(event.newValue) : undefined);
    } catch {
      memory = { ...DEFAULT_SETTINGS };
    }
    callback({ ...memory });
  };
  globalThis.addEventListener?.('storage', listener);
  return () => {
    listeners.delete(callback);
    globalThis.removeEventListener?.('storage', listener);
  };
}

export function resolveTheme(
  theme: Settings['theme'],
  systemTheme: 'light' | 'dark',
): 'light' | 'dark' {
  return theme === 'system' ? systemTheme : theme;
}

export function formatTime(ms: number, format: Settings['timeFormat'], now = Date.now()): string {
  const date = new Date(ms);
  if (!Number.isFinite(ms) || Number.isNaN(date.getTime())) return '—';
  if (format === 'iso') return date.toISOString();
  if (format === 'local') return date.toLocaleString('en-US');
  const delta = now - ms;
  const seconds = Math.abs(delta) / 1000;
  if (seconds < 1) return 'just now';
  const [amount, unit] =
    seconds < 60
      ? [Math.floor(seconds), 's']
      : seconds < 3600
        ? [Math.floor(seconds / 60), 'm']
        : seconds < 86400
          ? [Math.floor(seconds / 3600), 'h']
          : [Math.floor(seconds / 86400), 'd'];
  return delta >= 0 ? `${amount}${unit} ago` : `in ${amount}${unit}`;
}

export function extensionVersion(): string {
  try {
    return typeof chrome !== 'undefined'
      ? // version_name carries the full SemVer for prereleases (docs/design/12-versioning.md).
        (chrome.runtime?.getManifest?.().version_name ??
          chrome.runtime?.getManifest?.().version ??
          'Preview')
      : 'Preview';
  } catch {
    return 'Preview';
  }
}
