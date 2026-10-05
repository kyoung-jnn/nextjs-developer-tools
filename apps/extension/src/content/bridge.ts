import { bytesToBase64 } from '../shared/base64';
import { MESSAGE_SOURCE } from '../shared/constants';
import type { BridgeMessage, HookConfig, WireEvent } from '../shared/messages';
import { loadSettings } from '../shared/settings';
import { isHookEvent, isObject } from '../shared/validate';
import { type BufferEvent, RecordBuffer } from './record-buffer';

const buffer = new RecordBuffer();
let live = false;
let active = true;
function validRuntime(): boolean {
  try {
    if (!chrome.runtime.id) {
      active = false;
      live = false;
    }
    return active;
  } catch {
    active = false;
    live = false;
    return false;
  }
}
function send(message: BridgeMessage): void {
  if (!validRuntime()) return;
  try {
    void chrome.runtime.sendMessage(message).catch((error) => {
      if (/invalidated/i.test(String(error))) {
        active = false;
        live = false;
      }
    });
  } catch {
    active = false;
    live = false;
  }
}
function snapshot(): void {
  send({ type: 'snapshot', url: location.href, records: buffer.snapshot() });
}
function wire(event: BufferEvent): WireEvent {
  if (event.type === 'debug-chunk')
    return { ...event, chunk: event.chunk === null ? null : bytesToBase64(event.chunk) };
  if (event.type === 'record-chunk') return { ...event, chunk: bytesToBase64(event.chunk) };
  if (event.type === 'record-meta') {
    const { chunks, debugChunks, ...patch } = event.patch;
    return {
      ...event,
      patch: {
        ...patch,
        ...(debugChunks ? { debugChunks: debugChunks.map(bytesToBase64) } : {}),
        ...(chunks ? { chunks: chunks.map(bytesToBase64) } : {}),
      },
    };
  }
  return event;
}
window.addEventListener('message', (event) => {
  if (
    !validRuntime() ||
    event.source !== window ||
    !isObject(event.data) ||
    event.data.source !== MESSAGE_SOURCE ||
    event.data.direction !== 'hook' ||
    !isHookEvent(event.data.payload)
  )
    return;
  try {
    const payload = event.data.payload;
    const change = buffer.apply(payload);
    if (payload.type === 'detect') {
      send({ type: 'detect', detection: payload.detection });
      return;
    }
    if (!live) return;
    if (change.evicted) snapshot();
    else for (const event of change.events) send({ type: 'event', event: wire(event) });
  } catch {
    /* Ignore malformed page messages and capture failures. */
  }
});
window.addEventListener('pageshow', (event) => {
  if (!event.persisted || !validRuntime()) return;
  send({ type: 'hello', url: location.href });
  if (buffer.detection) send({ type: 'detect', detection: buffer.detection });
  if (live) snapshot();
});
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!validRuntime() || !isObject(message)) return;
  if (message.type === 'panel-attached') {
    live = true;
    snapshot();
  } else if (message.type === 'panel-detached') live = false;
  else if (message.type === 'debug-dump')
    sendResponse({ url: location.href, detection: buffer.detection, records: buffer.summary() });
});
send({ type: 'hello', url: location.href });
void loadSettings()
  .then((settings) => {
    if (!validRuntime()) return;
    const change = buffer.configure({
      records: settings.maxRecordsPerTab,
      totalBytes: settings.maxMegabytesPerTab * 1024 * 1024,
      capturePrefetch: settings.capturePrefetch,
    });
    const message: HookConfig = {
      source: MESSAGE_SOURCE,
      direction: 'bridge',
      payload: { type: 'hook-config', capturePrefetch: settings.capturePrefetch },
    };
    window.postMessage(message, '*');
    if (live && change.evicted) snapshot();
  })
  .catch(() => {
    /* Defaults remain active if extension storage is unavailable. */
  });
