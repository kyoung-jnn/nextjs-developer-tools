import type { MESSAGE_SOURCE } from './constants';
import type { CaptureRecord, Detection, WireRecord } from './types';
export type HookEvent =
  | { type: 'debug-chunk'; requestId: string; chunk: Uint8Array | null }
  | { type: 'detect'; detection: Detection }
  | {
      type: 'record-start';
      record: Omit<CaptureRecord, 'chunks' | 'done' | 'debugChunks' | 'debugDone'>;
    }
  | { type: 'record-chunk'; id: string; chunk: Uint8Array }
  | { type: 'record-meta'; id: string; patch: Partial<CaptureRecord> }
  | { type: 'record-end'; id: string; endTime: number; error?: string };
export interface HookMessage {
  source: typeof MESSAGE_SOURCE;
  direction: 'hook';
  payload: HookEvent;
}
export interface HookConfig {
  source: typeof MESSAGE_SOURCE;
  direction: 'bridge';
  payload: { type: 'hook-config'; capturePrefetch: boolean };
}
export type WireEvent =
  | Exclude<HookEvent, { type: 'record-chunk' | 'record-meta' | 'debug-chunk' }>
  | { type: 'debug-chunk'; recordId: string; chunk: string | null }
  | { type: 'record-chunk'; id: string; chunk: string }
  | { type: 'record-meta'; id: string; patch: Partial<WireRecord> };
export type BridgeMessage =
  | { type: 'hello'; url: string }
  | { type: 'detect'; detection: Detection }
  | { type: 'snapshot'; url: string; records: WireRecord[] }
  | { type: 'event'; event: WireEvent };
export type BackgroundToBridgeMessage = { type: 'panel-attached' } | { type: 'panel-detached' };
export type PanelToBackgroundMessage = { type: 'attach'; tabId: number };
export type BackgroundToPanelMessage =
  | Exclude<BridgeMessage, { type: 'hello' }>
  | { type: 'reset'; url: string };
