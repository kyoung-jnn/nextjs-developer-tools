import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  extensionVersion,
  formatTime,
  loadSettings,
  normalizeSettings,
  onSettingsChanged,
  persistSettings,
  resolveTheme,
  saveSettings,
} from '../src/shared/settings';

afterEach(() => vi.unstubAllGlobals());

describe('settings normalization', () => {
  it.each([undefined, null, false, [], 'bad', 100])('uses defaults for %j', (value) => {
    expect(normalizeSettings(value)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(value)).not.toBe(DEFAULT_SETTINGS);
  });
  it('clamps finite limits, rounds fractions, and rejects invalid numbers', () => {
    expect(
      normalizeSettings({ jsonExpandDepth: -4, maxRecordsPerTab: 5000, maxMegabytesPerTab: 25.7 }),
    ).toMatchObject({ jsonExpandDepth: 1, maxRecordsPerTab: 1000, maxMegabytesPerTab: 26 });
    expect(
      normalizeSettings({
        jsonExpandDepth: NaN,
        maxRecordsPerTab: '100',
        maxMegabytesPerTab: Infinity,
      }),
    ).toEqual(DEFAULT_SETTINGS);
    expect(
      normalizeSettings({ jsonExpandDepth: 11, maxRecordsPerTab: 1, maxMegabytesPerTab: 500 }),
    ).toMatchObject({ jsonExpandDepth: 10, maxRecordsPerTab: 50, maxMegabytesPerTab: 200 });
  });
  it('validates enums and strict booleans and drops unknown keys and storage version', () => {
    expect(
      normalizeSettings({
        theme: 'sepia',
        density: 'large',
        timeFormat: 'utc',
        defaultTab: 'Foo',
        hidePrefetch: 0,
        preserveLog: 'true',
        version: 9,
        extra: 'ignored',
      }),
    ).toEqual(DEFAULT_SETTINGS);
    expect(
      normalizeSettings({
        theme: 'dark',
        density: 'comfortable',
        timeFormat: 'iso',
        defaultTab: 'Raw',
        hidePrefetch: false,
        preserveLog: true,
      }),
    ).toMatchObject({
      theme: 'dark',
      density: 'comfortable',
      timeFormat: 'iso',
      defaultTab: 'Raw',
      hidePrefetch: false,
      preserveLog: true,
    });
  });
});

describe('theme and timestamp display', () => {
  it.each([
    ['system', 'light', 'light'],
    ['system', 'dark', 'dark'],
    ['light', 'dark', 'light'],
    ['dark', 'light', 'dark'],
  ] as const)('resolves %s with system %s', (theme, system, expected) => {
    expect(resolveTheme(theme, system)).toBe(expected);
  });
  it('formats local and ISO dates and invalid dates', () => {
    const ms = Date.UTC(2026, 9, 5, 12, 30, 15);
    expect(formatTime(ms, 'iso')).toBe('2026-10-05T12:30:15.000Z');
    expect(formatTime(ms, 'local')).toBe(new Date(ms).toLocaleString('en-US'));
    expect(formatTime(NaN, 'iso')).toBe('—');
    expect(formatTime(Infinity, 'relative')).toBe('—');
  });
  it.each([
    [0, 'just now'],
    [12000, '12s ago'],
    [120000, '2m ago'],
    [7200000, '2h ago'],
    [172800000, '2d ago'],
    [-120000, 'in 2m'],
  ])('formats relative age %d', (age, expected) => {
    expect(formatTime(1000000000 - age, 'relative', 1000000000)).toBe(expected);
  });
  it('reads extension version with a preview fallback', () => {
    vi.stubGlobal('chrome', undefined);
    expect(extensionVersion()).toBe('Preview');
    vi.stubGlobal('chrome', { runtime: { getManifest: () => ({ version: '1.2.3' }) } });
    expect(extensionVersion()).toBe('1.2.3');
  });
});

describe('settings persistence', () => {
  it('forwards extension writes to the service worker without reading or writing storage locally', async () => {
    const sendMessage = vi.fn(async () => ({ ...DEFAULT_SETTINGS, theme: 'dark' }));
    const get = vi.fn();
    const set = vi.fn();
    vi.stubGlobal('chrome', { runtime: { sendMessage }, storage: { sync: { get, set } } });
    expect(await saveSettings({ theme: 'dark' })).toEqual({ ...DEFAULT_SETTINGS, theme: 'dark' });
    expect(sendMessage).toHaveBeenCalledWith({ type: 'save-settings', patch: { theme: 'dark' } });
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });
  it('propagates runtime and worker failures without attempting direct storage writes', async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error('Worker unavailable'))
      .mockResolvedValueOnce({ error: 'Quota exceeded' })
      .mockResolvedValueOnce(undefined);
    const set = vi.fn();
    vi.stubGlobal('chrome', { runtime: { sendMessage }, storage: { sync: { set } } });
    await expect(saveSettings({ theme: 'dark' })).rejects.toThrow('Worker unavailable');
    await expect(saveSettings({ theme: 'dark' })).rejects.toThrow('Quota exceeded');
    await expect(saveSettings({ theme: 'dark' })).rejects.toThrow(
      'invalid service worker response',
    );
    expect(set).not.toHaveBeenCalled();
  });
  it('serializes independent UI clients in the real background message handler', async () => {
    let stored: unknown = { version: 1, ...DEFAULT_SETTINGS };
    let handler: (
      message: unknown,
      sender: { id: string },
      response: (value: unknown) => void,
    ) => unknown = () => undefined;
    const sendMessage = vi.fn(
      (message: unknown) =>
        new Promise((resolve) => {
          handler(message, { id: 'extension-id' }, resolve);
        }),
    );
    const set = vi.fn(async (data: { settings: unknown }) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      stored = data.settings;
    });
    vi.stubGlobal('chrome', {
      runtime: {
        id: 'extension-id',
        sendMessage,
        onMessage: {
          addListener: (listener: typeof handler) => {
            handler = listener;
          },
        },
        onConnect: { addListener: vi.fn() },
      },
      storage: {
        sync: { get: async () => ({ settings: stored }), set },
        session: { get: async () => ({}) },
      },
      tabs: { onRemoved: { addListener: vi.fn() } },
    });
    vi.resetModules();
    await import('../src/background/index');
    const clientA = await import('../src/shared/settings');
    vi.resetModules();
    const clientB = await import('../src/shared/settings');
    await Promise.all([
      clientA.saveSettings({ theme: 'dark' }),
      clientB.saveSettings({ preserveLog: true }),
    ]);
    expect(stored).toMatchObject({ version: 1, theme: 'dark', preserveLog: true });
    expect(set).toHaveBeenCalledTimes(2);
    const invalid = vi.fn();
    handler({ type: 'save-settings', patch: [] }, { id: 'extension-id' }, invalid);
    expect(invalid).toHaveBeenCalledWith({ error: 'Invalid settings request' });
    handler(
      { type: 'save-settings', patch: { theme: 'light' } },
      { id: 'other-extension' },
      invalid,
    );
    expect(set).toHaveBeenCalledTimes(2);
  });
  it('lets the worker persist directly without recursively sending a runtime message', async () => {
    const sendMessage = vi.fn();
    const set = vi.fn(async () => undefined);
    vi.stubGlobal('chrome', {
      runtime: { sendMessage },
      storage: {
        sync: { get: async () => ({ settings: DEFAULT_SETTINGS }), set },
      },
    });
    await persistSettings({ theme: 'dark' });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith({
      settings: { version: 1, ...DEFAULT_SETTINGS, theme: 'dark' },
    });
  });
  it('stores versioned normalized patches in sync and preserves other values', async () => {
    let stored: unknown = { version: 1, ...DEFAULT_SETTINGS, theme: 'dark' };
    const set = vi.fn(async (value: { settings: unknown }) => {
      stored = value.settings;
    });
    vi.stubGlobal('chrome', {
      storage: { sync: { get: async () => ({ settings: stored }), set } },
    });
    expect(await loadSettings()).toMatchObject({ theme: 'dark' });
    expect(await saveSettings({ jsonExpandDepth: 99 })).toMatchObject({
      theme: 'dark',
      jsonExpandDepth: 10,
    });
    expect(set).toHaveBeenCalledWith({
      settings: { version: 1, ...DEFAULT_SETTINGS, theme: 'dark', jsonExpandDepth: 10 },
    });
    await Promise.all([
      saveSettings({ density: 'comfortable' }),
      saveSettings({ preserveLog: true }),
    ]);
    expect(await loadSettings()).toMatchObject({ density: 'comfortable', preserveLog: true });
  });
  it('subscribes only to sync settings and removes the listener', () => {
    const addListener = vi.fn();
    const removeListener = vi.fn();
    vi.stubGlobal('chrome', { storage: { onChanged: { addListener, removeListener } } });
    const callback = vi.fn();
    const unsubscribe = onSettingsChanged(callback);
    const listener = addListener.mock.calls[0]?.[0];
    listener({ settings: { newValue: { theme: 'dark' } } }, 'local');
    listener({ unrelated: { newValue: true } }, 'sync');
    expect(callback).not.toHaveBeenCalled();
    listener({ settings: { newValue: { theme: 'dark', bogus: true } } }, 'sync');
    expect(callback).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, theme: 'dark' });
    unsubscribe();
    expect(removeListener).toHaveBeenCalledWith(listener);
  });
  it('persists preview values and broadcasts same-window and cross-window updates', async () => {
    const values = new Map<string, string>();
    vi.stubGlobal('chrome', undefined);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    const add = vi.fn();
    const remove = vi.fn();
    vi.stubGlobal('addEventListener', add);
    vi.stubGlobal('removeEventListener', remove);
    const callback = vi.fn();
    const unsubscribe = onSettingsChanged(callback);
    await saveSettings({ ...DEFAULT_SETTINGS, theme: 'dark' });
    expect(callback).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, theme: 'dark' });
    expect(JSON.parse(values.get('settings') ?? '{}')).toMatchObject({ version: 1, theme: 'dark' });
    expect(await loadSettings()).toMatchObject({ theme: 'dark' });
    const listener = add.mock.calls[0]?.[1];
    listener({ key: 'settings', newValue: JSON.stringify({ theme: 'light' }) });
    expect(callback).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, theme: 'light' });
    unsubscribe();
    expect(remove).toHaveBeenCalledWith('storage', listener);
  });
  it('still works when preview storage access throws', async () => {
    vi.stubGlobal('chrome', undefined);
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('disabled');
      },
      setItem: () => {
        throw new Error('disabled');
      },
    });
    expect(await saveSettings({ ...DEFAULT_SETTINGS, theme: 'light' })).toMatchObject({
      theme: 'light',
    });
    expect(await loadSettings()).toMatchObject({ theme: 'light' });
  });
});
