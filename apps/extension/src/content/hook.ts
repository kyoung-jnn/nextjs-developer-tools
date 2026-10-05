import { extractSegmentsFromScript, segmentToBytes } from '@nextjs-devtools/flight-parser';
import { MESSAGE_SOURCE } from '../shared/constants';
import { detectNext } from '../shared/detect';
import type { HookEvent } from '../shared/messages';
import { isObject } from '../shared/validate';
import { createFetchHook } from './fetch-hook';
import { installNextFHook } from './next-f-hook';
import { createWebSocketHook } from './websocket-hook';

const prefix = Math.random().toString(36).slice(2);
let sequence = 0;
const nextId = (): string => `${prefix}-${++sequence}`;
let capturePrefetch = true;
window.addEventListener('message', (event) => {
  if (
    event.source === window &&
    isObject(event.data) &&
    event.data.source === MESSAGE_SOURCE &&
    event.data.direction === 'bridge' &&
    isObject(event.data.payload) &&
    event.data.payload.type === 'hook-config' &&
    typeof event.data.payload.capturePrefetch === 'boolean'
  )
    capturePrefetch = event.data.payload.capturePrefetch;
});
function emit(payload: HookEvent): void {
  try {
    window.postMessage({ source: MESSAGE_SOURCE, direction: 'hook', payload }, '*');
  } catch {
    /* The page may contain values that cannot be cloned. */
  }
}
function safely(work: () => void): void {
  try {
    work();
  } catch {
    /* Never interrupt page code. */
  }
}
let documentId: string | undefined;
let documentEnded = false;
let sawSegment = false;
let hasHmr = false;
let finalDetection = false;
let previousDetection = '';
function onSegment(segment: unknown): void {
  if (!Array.isArray(segment)) return;
  sawSegment = true;
  const kind = segment[0];
  if (!documentId && (kind === 0 || kind === 1 || kind === 3)) {
    documentId = nextId();
    emit({
      type: 'record-start',
      record: {
        id: documentId,
        kind: 'document',
        url: location.href,
        method: 'GET',
        requestHeaders: {},
        responseHeaders: {},
        startTime: Date.now(),
      },
    });
  }
  if (!documentId || documentEnded) return;
  const bytes = segmentToBytes(segment);
  if (bytes) emit({ type: 'record-chunk', id: documentId, chunk: bytes });
  else if (kind === 2)
    emit({ type: 'record-meta', id: documentId, patch: { formState: segment[1] } });
}
installNextFHook(window, onSegment);
safely(() => {
  window.WebSocket = createWebSocketHook(window.WebSocket, emit, () => {
    hasHmr = true;
    detect();
  });
});
function linkDocumentRequest(): void {
  safely(() => {
    const requestId: unknown = Reflect.get(window, '__next_r');
    if (documentId && typeof requestId === 'string')
      emit({ type: 'record-meta', id: documentId, patch: { requestId } });
  });
}
safely(() => {
  window.fetch = createFetchHook(window.fetch, {
    emit,
    nextId,
    baseUrl: () => location.href,
    capturePrefetch: () => capturePrefetch,
  });
});
function inlineScripts(): string[] {
  return Array.from(
    document.querySelectorAll('script:not([src])'),
    (script) => script.textContent ?? '',
  );
}
function detect(final = false): void {
  safely(() => {
    if (final) finalDetection = true;
    const next: unknown = Reflect.get(window, 'next');
    const data = document.getElementById('__NEXT_DATA__');
    let buildId: string | undefined;
    try {
      const parsed: unknown = JSON.parse(data?.textContent ?? 'null');
      if (
        parsed &&
        typeof parsed === 'object' &&
        'buildId' in parsed &&
        typeof parsed.buildId === 'string'
      )
        buildId = parsed.buildId;
    } catch {
      /* Malformed document data is still a detection signal. */
    }
    const detection = detectNext({
      windowNext: next && typeof next === 'object' ? next : null,
      hasNextData: data !== null,
      hasHmr,
      hasDevOverlay: document.querySelector('nextjs-portal') !== null,
      final: finalDetection,
      nextDataBuildId: buildId,
      hasNextF: sawSegment || inlineScripts().some((text) => text.includes('self.__next_f')),
      hasNextStatic:
        document.querySelector('script[src*="/_next/static/"],link[href*="/_next/static/"]') !==
        null,
    });
    const serialized = JSON.stringify(detection);
    if (serialized !== previousDetection && (detection.isNext || finalDetection)) {
      previousDetection = serialized;
      emit({ type: 'detect', detection });
    }
  });
}
function onReady(): void {
  linkDocumentRequest();
  safely(() => {
    const data = document.querySelector('script#__NEXT_DATA__');
    if (!data) return;
    const id = nextId();
    emit({
      type: 'record-start',
      record: {
        id,
        kind: 'pages-document',
        url: location.href,
        method: 'GET',
        requestHeaders: {},
        responseHeaders: {},
        startTime: Date.now(),
      },
    });
    emit({ type: 'record-chunk', id, chunk: new TextEncoder().encode(data.textContent ?? '') });
    emit({ type: 'record-end', id, endTime: Date.now() });
  });
  detect();
}
function onLoad(): void {
  safely(() => {
    if (!sawSegment)
      for (const source of inlineScripts())
        for (const segment of extractSegmentsFromScript(source)) onSegment(segment);
    linkDocumentRequest();
    if (documentId && !documentEnded) {
      documentEnded = true;
      emit({ type: 'record-end', id: documentId, endTime: Date.now() });
    }
  });
  detect();
  setTimeout(() => detect(true), 1500);
}
if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', onReady, { once: true });
else onReady();
if (document.readyState === 'complete') onLoad();
else window.addEventListener('load', onLoad, { once: true });
