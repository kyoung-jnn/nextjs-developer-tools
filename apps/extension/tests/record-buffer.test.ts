import { describe, expect, it } from 'vitest';
import { RecordBuffer } from '../src/content/record-buffer';
import { base64ToBytes } from '../src/shared/base64';
import { encode, start } from './helpers';

describe('Record buffer', () => {
  it('assembles metadata, immutable chunks, completion and base64 snapshots', () => {
    const buffer = new RecordBuffer();
    buffer.apply(start());
    const chunk = encode('café — 👋');
    buffer.apply({ type: 'record-chunk', id: 'record', chunk });
    chunk.fill(0);
    buffer.apply({
      type: 'record-meta',
      id: 'record',
      patch: { status: 200, formState: { ok: true }, requestHeaders: { rsc: '1' } },
    });
    buffer.apply({ type: 'record-end', id: 'record', endTime: 20 });
    const snapshot = buffer.snapshot()[0];
    expect(snapshot).toMatchObject({
      done: true,
      endTime: 20,
      status: 200,
      formState: { ok: true },
    });
    expect(new TextDecoder().decode(base64ToBytes(snapshot?.chunks[0] ?? ''))).toBe('café — 👋');
    expect(
      buffer.apply({ type: 'record-chunk', id: 'record', chunk: encode('late') }).events,
    ).toEqual([]);
    expect(buffer.apply(start()).events).toEqual([]);
    expect(buffer.apply({ type: 'record-end', id: 'missing', endTime: 0 }).events).toEqual([]);
  });
  it('truncates combined main/debug bytes and preserves the truncation error', () => {
    const buffer = new RecordBuffer({ recordBytes: 5, records: 3, totalBytes: 20 });
    buffer.apply(start('r', 'next'));
    buffer.apply({ type: 'record-chunk', id: 'r', chunk: encode('123') });
    const change = buffer.apply({ type: 'debug-chunk', requestId: 'next', chunk: encode('4567') });
    expect(change.events).toContainEqual({
      type: 'record-meta',
      id: 'r',
      patch: { error: 'truncated' },
    });
    buffer.apply({
      type: 'record-meta',
      id: 'r',
      patch: { error: 'other', id: 'fake', chunks: [encode('bad')] },
    });
    buffer.apply({ type: 'record-end', id: 'r', endTime: 30, error: 'network' });
    buffer.apply({ type: 'debug-chunk', requestId: 'next', chunk: null });
    expect(buffer.summary()[0]).toMatchObject({
      id: 'r',
      byteLength: 5,
      debugByteLength: 2,
      done: true,
      debugDone: true,
      error: 'truncated',
    });
  });
  it('evicts oldest records for count and total-size limits including debug data', () => {
    const buffer = new RecordBuffer({ recordBytes: 10, records: 2, totalBytes: 5 });
    buffer.apply(start('a', 'qa'));
    buffer.apply({ type: 'record-chunk', id: 'a', chunk: encode('123') });
    buffer.apply(start('b', 'qb'));
    expect(
      buffer.apply({ type: 'debug-chunk', requestId: 'qb', chunk: encode('456') }).evicted,
    ).toBe(true);
    expect(buffer.snapshot().map((r) => r.id)).toEqual(['b']);
    buffer.apply(start('c'));
    expect(buffer.apply(start('d')).evicted).toBe(true);
    expect(buffer.snapshot().map((r) => r.id)).toEqual(['c', 'd']);
  });
  it('links early debug chunks/end by metadata even after document completion', () => {
    const buffer = new RecordBuffer();
    buffer.apply({ type: 'debug-chunk', requestId: 'next', chunk: encode('debug') });
    buffer.apply({ type: 'debug-chunk', requestId: 'next', chunk: null });
    buffer.apply(start());
    buffer.apply({ type: 'record-end', id: 'record', endTime: 20 });
    const change = buffer.apply({
      type: 'record-meta',
      id: 'record',
      patch: { requestId: 'next' },
    });
    expect(change.events).toContainEqual({
      type: 'debug-chunk',
      recordId: 'record',
      chunk: encode('debug'),
    });
    expect(buffer.summary()[0]).toMatchObject({
      requestId: 'next',
      debugByteLength: 5,
      debugDone: true,
    });
  });
  it('caps early chunks at 2 MiB, 50 request IDs, and 60 seconds', () => {
    let now = 0;
    const buffer = new RecordBuffer(undefined, () => now);
    buffer.apply({
      type: 'debug-chunk',
      requestId: 'large',
      chunk: new Uint8Array(2 * 1024 * 1024 + 1),
    });
    buffer.apply(start('large', 'large'));
    expect(buffer.summary()[0]).toMatchObject({
      debugByteLength: 2 * 1024 * 1024,
      error: 'truncated',
    });
    for (let index = 0; index < 51; index++)
      buffer.apply({ type: 'debug-chunk', requestId: `q${index}`, chunk: Uint8Array.of(index) });
    buffer.apply(start('oldest', 'q0'));
    expect(buffer.summary().find((r) => r.id === 'oldest')?.debugByteLength).toBe(0);
    buffer.apply(start('kept', 'q1'));
    expect(buffer.summary().find((r) => r.id === 'kept')?.debugByteLength).toBe(1);
    now = 60000;
    buffer.apply(start('expired', 'q50'));
    expect(buffer.summary().find((r) => r.id === 'expired')?.debugByteLength).toBe(0);
  });
});
