import { bytesToBase64 } from '../shared/base64';
import { MAX_RECORD_BYTES, MAX_RECORDS, MAX_TOTAL_BYTES } from '../shared/constants';
import type { HookEvent } from '../shared/messages';
import type { CaptureRecord, Detection, WireRecord } from '../shared/types';
import { isPrefetchRecord } from './prefetch';
export interface BufferLimits {
  recordBytes: number;
  records: number;
  totalBytes: number;
}
export type BufferEvent =
  | Exclude<HookEvent, { type: 'debug-chunk' }>
  | { type: 'debug-chunk'; recordId: string; chunk: Uint8Array | null };
export interface BufferChange {
  events: BufferEvent[];
  evicted: boolean;
}
interface PendingDebug {
  chunks: Uint8Array[];
  size: number;
  done: boolean;
  created: number;
  truncated: boolean;
}
export class RecordBuffer {
  private records = new Map<string, CaptureRecord>();
  private sizes = new Map<string, number>();
  private requests = new Map<string, string>();
  private pending = new Map<string, PendingDebug>();
  private total = 0;
  private capturePrefetch = true;
  private ignoredRequests = new Set<string>();
  detection: Detection | null = null;
  constructor(
    private limits: BufferLimits = {
      recordBytes: MAX_RECORD_BYTES,
      records: MAX_RECORDS,
      totalBytes: MAX_TOTAL_BYTES,
    },
    private now: () => number = Date.now,
  ) {}
  configure(
    config: Partial<Pick<BufferLimits, 'records' | 'totalBytes'>> & {
      capturePrefetch?: boolean;
    },
  ): BufferChange {
    const { capturePrefetch, ...limits } = config;
    this.limits = { ...this.limits, ...limits };
    if (capturePrefetch !== undefined) this.capturePrefetch = capturePrefetch;
    let evicted = false;
    if (!this.capturePrefetch)
      for (const [id, record] of this.records)
        if (isPrefetchRecord(record)) {
          this.ignoreRequest(record.requestId);
          this.remove(id);
          evicted = true;
        }
    return { events: [], evicted: this.enforceLimits() || evicted };
  }
  private ignoreRequest(requestId?: string): void {
    if (!requestId) return;
    this.pending.delete(requestId);
    this.ignoredRequests.add(requestId);
    while (this.ignoredRequests.size > 1000) {
      const oldest = this.ignoredRequests.values().next().value;
      if (oldest === undefined) break;
      this.ignoredRequests.delete(oldest);
    }
  }
  private remove(id: string): void {
    const record = this.records.get(id);
    if (record?.requestId && this.requests.get(record.requestId) === id)
      this.requests.delete(record.requestId);
    this.total -= this.sizes.get(id) ?? 0;
    this.records.delete(id);
    this.sizes.delete(id);
  }
  private enforceLimits(): boolean {
    let evicted = false;
    while (this.records.size > this.limits.records || this.total > this.limits.totalBytes) {
      const id = this.records.keys().next().value;
      if (id === undefined) break;
      this.remove(id);
      evicted = true;
    }
    return evicted;
  }
  private append(
    record: CaptureRecord,
    chunk: Uint8Array,
    debug: boolean,
    events: BufferEvent[],
  ): void {
    if (record.error === 'truncated') return;
    const size = this.sizes.get(record.id) ?? 0;
    const count = Math.max(0, Math.min(chunk.byteLength, this.limits.recordBytes - size));
    if (count > 0) {
      const copy = chunk.slice(0, count);
      (debug ? record.debugChunks : record.chunks).push(copy);
      this.sizes.set(record.id, size + count);
      this.total += count;
      events.push(
        debug
          ? { type: 'debug-chunk', recordId: record.id, chunk: copy }
          : { type: 'record-chunk', id: record.id, chunk: copy },
      );
    }
    if (count < chunk.byteLength) {
      record.error = 'truncated';
      events.push({ type: 'record-meta', id: record.id, patch: { error: 'truncated' } });
    }
  }
  private link(record: CaptureRecord, events: BufferEvent[]): void {
    if (!record.requestId) return;
    this.requests.set(record.requestId, record.id);
    const pending = this.pending.get(record.requestId);
    if (!pending) return;
    this.pending.delete(record.requestId);
    for (const chunk of pending.chunks) this.append(record, chunk, true, events);
    if (pending.truncated) {
      record.error = 'truncated';
      events.push({ type: 'record-meta', id: record.id, patch: { error: 'truncated' } });
    }
    if (pending.done) {
      record.debugDone = true;
      events.push({ type: 'debug-chunk', recordId: record.id, chunk: null });
    }
  }
  apply(event: HookEvent): BufferChange {
    const events: BufferEvent[] = [];
    for (const [id, value] of this.pending)
      if (this.now() - value.created >= 60000) this.pending.delete(id);
    if (event.type === 'detect') {
      this.detection = event.detection;
      return { events: [event], evicted: false };
    }
    if (event.type === 'debug-chunk') {
      if (this.ignoredRequests.has(event.requestId)) return { events, evicted: false };
      const id = this.requests.get(event.requestId);
      const record = id ? this.records.get(id) : undefined;
      if (record) {
        if (event.chunk === null) {
          record.debugDone = true;
          events.push({ type: 'debug-chunk', recordId: record.id, chunk: null });
        } else if (!record.debugDone) this.append(record, event.chunk, true, events);
      } else {
        let pending = this.pending.get(event.requestId);
        if (!pending) {
          pending = { chunks: [], size: 0, done: false, created: this.now(), truncated: false };
          this.pending.set(event.requestId, pending);
        }
        if (event.chunk === null) pending.done = true;
        else if (!pending.done) {
          const count = Math.min(event.chunk.length, Math.max(0, 2 * 1024 * 1024 - pending.size));
          if (count) {
            pending.chunks.push(event.chunk.slice(0, count));
            pending.size += count;
          }
          if (count < event.chunk.length) pending.truncated = true;
        }
        while (this.pending.size > 50) {
          const oldest = this.pending.keys().next().value;
          if (oldest === undefined) break;
          this.pending.delete(oldest);
        }
      }
    } else if (event.type === 'record-start') {
      if (!this.capturePrefetch && isPrefetchRecord(event.record)) {
        this.ignoreRequest(event.record.requestId);
        return { events, evicted: false };
      }
      if (this.records.has(event.record.id)) return { events, evicted: false };
      const record: CaptureRecord = {
        ...event.record,
        chunks: [],
        debugChunks: [],
        debugDone: false,
        done: false,
      };
      this.records.set(record.id, record);
      this.sizes.set(record.id, 0);
      events.push(event);
      this.link(record, events);
    } else {
      const record = this.records.get(event.id);
      if (!record) return { events, evicted: false };
      if (event.type === 'record-chunk') {
        if (!record.done) this.append(record, event.chunk, false, events);
      } else if (event.type === 'record-meta') {
        const patch: Partial<CaptureRecord> = {};
        for (const key of [
          'status',
          'responseHeaders',
          'requestHeaders',
          'endTime',
          'done',
          'formState',
          'error',
          'requestId',
        ] as const)
          if (key in event.patch && !(key === 'error' && record.error === 'truncated'))
            Object.assign(patch, { [key]: event.patch[key] });
        if (
          patch.requestId !== undefined &&
          record.requestId &&
          record.requestId !== patch.requestId &&
          this.requests.get(record.requestId) === record.id
        )
          this.requests.delete(record.requestId);
        Object.assign(record, patch);
        if (!this.capturePrefetch && isPrefetchRecord(record)) {
          this.ignoreRequest(record.requestId);
          this.remove(record.id);
          return { events: [], evicted: true };
        }
        events.push({ ...event, patch });
        this.link(record, events);
      } else {
        record.done = true;
        record.endTime = event.endTime;
        if (event.error && record.error !== 'truncated') record.error = event.error;
        events.push({ ...event, ...(record.error ? { error: record.error } : {}) });
      }
    }
    const evicted = this.enforceLimits();
    return { events, evicted };
  }
  snapshot(): WireRecord[] {
    return Array.from(this.records.values(), (record) => ({
      ...record,
      chunks: record.chunks.map(bytesToBase64),
      debugChunks: record.debugChunks.map(bytesToBase64),
    }));
  }
  summary() {
    return Array.from(this.records.values(), (record) => ({
      id: record.id,
      kind: record.kind,
      url: record.url,
      method: record.method,
      status: record.status,
      byteLength: this.sizes.get(record.id) ?? 0,
      done: record.done,
      error: record.error,
      requestId: record.requestId,
      debugByteLength: record.debugChunks.reduce((n, c) => n + c.length, 0),
      debugDone: record.debugDone,
    }));
  }
}
