import type { HookEvent } from '../src/shared/messages';
import type { CaptureRecord, WireRecord } from '../src/shared/types';
export const encode = (value: string) => new TextEncoder().encode(value);
export function start(
  id = 'record',
  requestId?: string,
): Extract<HookEvent, { type: 'record-start' }> {
  return {
    type: 'record-start',
    record: {
      id,
      kind: 'document',
      url: 'https://demo.test/',
      method: 'GET',
      requestHeaders: {},
      responseHeaders: {},
      startTime: 10,
      ...(requestId ? { requestId } : {}),
    },
  };
}
export function wireRecord(id = 'record', extra: Partial<WireRecord> = {}): WireRecord {
  return {
    ...start(id).record,
    chunks: [],
    debugChunks: [],
    debugDone: false,
    done: true,
    ...extra,
  };
}

export function captureRecord(id = 'record', extra: Partial<CaptureRecord> = {}): CaptureRecord {
  return {
    ...start(id).record,
    chunks: [],
    debugChunks: [],
    debugDone: false,
    done: true,
    ...extra,
  };
}
