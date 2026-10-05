import type { BackgroundToPanelMessage } from '../shared/messages';
import { persistSettings, type Settings } from '../shared/settings';
import type { Detection } from '../shared/types';
import { isDetection, isObject } from '../shared/validate';
import { actionStateFor } from './action-state';

const ports = new Map<number, chrome.runtime.Port>();
const detections = new Map<number, Detection>();
const cleared = new Set<number>();
const actions = new Map<number, Promise<void>>();
let persistence = Promise.resolve();
const keyFor = (tabId: number): string => `detection:${tabId}`;
const ready = chrome.storage.session
  .get(null)
  .then((stored) => {
    for (const [key, value] of Object.entries(stored)) {
      if (!key.startsWith('detection:') || !isDetection(value)) continue;
      const tabId = Number(key.slice('detection:'.length));
      if (Number.isInteger(tabId) && !cleared.has(tabId) && !detections.has(tabId))
        detections.set(tabId, value);
    }
  })
  .catch(() => {});
function persist(work: () => Promise<unknown>): void {
  persistence = persistence
    .then(work)
    .then(() => {})
    .catch(() => {});
}
function applyState(tabId: number, detection: Detection | null): void {
  const state = actionStateFor(detection);
  const pending = (actions.get(tabId) ?? Promise.resolve())
    .then(async () => {
      const path = Object.fromEntries(
        [16, 32, 48, 128].map((size) => [size, `icons/${state.iconSet}-${size}.png`]),
      );
      await Promise.allSettled([
        chrome.action.setIcon({ tabId, path }),
        // Clear any badge left by an older build; the router label is no longer shown.
        chrome.action.setBadgeText({ tabId, text: '' }),
        chrome.action.setTitle({ tabId, title: state.title }),
      ]);
    })
    .catch(() => {});
  actions.set(tabId, pending);
  void pending.then(() => {
    if (actions.get(tabId) === pending) actions.delete(tabId);
  });
}
function post(tabId: number, message: BackgroundToPanelMessage): void {
  try {
    ports.get(tabId)?.postMessage(message);
  } catch {
    /* The panel may have disconnected. */
  }
}
function notify(tabId: number, type: 'panel-attached' | 'panel-detached'): void {
  void chrome.tabs.sendMessage(tabId, { type }).catch(() => {});
}
chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (isObject(message) && message.type === 'save-settings') {
    if (sender.id !== chrome.runtime.id || !isObject(message.patch)) {
      sendResponse({ error: 'Invalid settings request' });
      return;
    }
    void persistSettings(message.patch as Partial<Settings>).then(sendResponse, (error: unknown) =>
      sendResponse({
        error: error instanceof Error ? error.message : 'Could not save settings',
      }),
    );
    return true;
  }
  if (
    isObject(message) &&
    message.type === 'get-detection' &&
    typeof message.tabId === 'number' &&
    Number.isInteger(message.tabId) &&
    message.tabId >= 0
  ) {
    const requestedTab = message.tabId;
    void ready.then(() => sendResponse(detections.get(requestedTab) ?? null));
    return true;
  }
  const tabId = sender.tab?.id;
  if (tabId === undefined || sender.frameId !== 0 || !isObject(message)) return;
  if (message.type === 'hello' && typeof message.url === 'string') {
    detections.delete(tabId);
    cleared.add(tabId);
    persist(() => chrome.storage.session.remove(keyFor(tabId)));
    applyState(tabId, null);
    post(tabId, { type: 'reset', url: message.url });
    // A new document needs to re-enter live mode when its panel is already open.
    if (ports.has(tabId)) notify(tabId, 'panel-attached');
  } else if (message.type === 'detect' && isDetection(message.detection)) {
    detections.set(tabId, message.detection);
    cleared.delete(tabId);
    const detection = message.detection;
    persist(() => chrome.storage.session.set({ [keyFor(tabId)]: detection }));
    applyState(tabId, detection);
    post(tabId, { type: 'detect', detection });
  } else if (
    message.type === 'snapshot' &&
    typeof message.url === 'string' &&
    Array.isArray(message.records)
  ) {
    post(tabId, { type: 'snapshot', url: message.url, records: message.records });
  } else if (message.type === 'event' && isObject(message.event)) {
    // Bridge messages are extension-internal and have already been validated.
    post(tabId, message as unknown as BackgroundToPanelMessage);
  }
});
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'panel') return;
  let tabId: number | undefined;
  let connected = true;
  port.onMessage.addListener((message: unknown) => {
    if (
      tabId !== undefined ||
      !connected ||
      !isObject(message) ||
      message.type !== 'attach' ||
      typeof message.tabId !== 'number' ||
      !Number.isInteger(message.tabId) ||
      message.tabId < 0
    )
      return;
    tabId = message.tabId;
    ports.set(tabId, port);
    notify(tabId, 'panel-attached');
    const attachedTab = tabId;
    void ready.then(() => {
      if (ports.get(attachedTab) !== port || !connected) return;
      const detection = detections.get(attachedTab);
      if (detection) post(attachedTab, { type: 'detect', detection });
    });
  });
  port.onDisconnect.addListener(() => {
    connected = false;
    if (tabId === undefined || ports.get(tabId) !== port) return;
    ports.delete(tabId);
    notify(tabId, 'panel-detached');
  });
});
chrome.tabs.onRemoved.addListener((tabId) => {
  ports.delete(tabId);
  detections.delete(tabId);
  cleared.add(tabId);
  actions.delete(tabId);
  persist(() => chrome.storage.session.remove(keyFor(tabId)));
});
