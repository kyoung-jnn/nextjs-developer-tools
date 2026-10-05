import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ParsedRecord, parseRecord } from '../src/panel/parse';
import { createPanelStore, isPrefetch } from '../src/panel/store';
import { bytesToBase64 } from '../src/shared/base64';
import { captureRecord, encode, start, wireRecord } from './helpers';

const empty = { url: 'https://demo.test/', detection: null, records: [] };
const bytes = bytesToBase64(encode('0:{"value":1}\n'));
describe('Panel store', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it('initializes from attach snapshots, decodes once, and memoizes only the selected record', async () => {
    const parse = vi.fn(parseRecord);
    const a = wireRecord('a', { chunks: [bytes] });
    const b = wireRecord('b', { chunks: [bytes] });
    const store = createPanelStore({ ...empty, records: [a, b] }, { parse });
    await vi.runAllTimersAsync();
    expect(parse).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().selected).toBe('0:a');
    const chunk = store.getSnapshot().records[0]?.chunks[0];
    store.update({ type: 'snapshot', url: empty.url, records: [a, b] });
    await vi.runAllTimersAsync();
    expect(store.getSnapshot().records[0]?.chunks[0]).toBe(chunk);
    expect(parse).toHaveBeenCalledTimes(1);
    store.select('0:b');
    await vi.runAllTimersAsync();
    store.select('0:a');
    await vi.runAllTimersAsync();
    expect(parse).toHaveBeenCalledTimes(2);
    store.update({ type: 'event', event: { type: 'record-chunk', id: 'b', chunk: bytes } });
    await vi.runAllTimersAsync();
    expect(parse).toHaveBeenCalledTimes(2);
    store.dispose();
  });
  it('applies events and independent debug chunks, merging server logs with main values', async () => {
    const store = createPanelStore(empty);
    store.update({ type: 'event', event: start('r', 'request') });
    store.update({ type: 'event', event: { type: 'record-chunk', id: 'r', chunk: bytes } });
    store.update({
      type: 'event',
      event: { type: 'record-meta', id: 'r', patch: { status: 200 } },
    });
    store.update({ type: 'event', event: { type: 'record-end', id: 'r', endTime: 20 } });
    store.update({
      type: 'event',
      event: {
        type: 'debug-chunk',
        recordId: 'r',
        chunk: bytesToBase64(encode('0:{"debug":true}\n2:W["log",[],null,"Server","ready"]\n')),
      },
    });
    store.update({ type: 'event', event: { type: 'debug-chunk', recordId: 'r', chunk: null } });
    await vi.runAllTimersAsync();
    const state = store.getSnapshot();
    expect(state.records[0]).toMatchObject({ status: 200, done: true, debugDone: true });
    expect(state.parsed?.type).toBe('flight');
    if (state.parsed?.type !== 'flight') throw Error('Expected Flight');
    expect(state.parsed.logSource).toBe('debug channel');
    expect(state.parsed.payload.chunks.get(0)?.value).toEqual({ value: 1 });
    expect(state.parsed.payload.console[0]?.args).toEqual(['ready']);
    store.dispose();
  });
  it('throttles streaming to four parses per second including debug after main completion', async () => {
    const parse = vi.fn(parseRecord);
    const store = createPanelStore(
      { ...empty, records: [wireRecord('r', { requestId: 'next', chunks: [bytes], done: true })] },
      { parse },
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(parse).toHaveBeenCalledTimes(1);
    for (let index = 0; index < 10; index++) {
      store.update({
        type: 'event',
        event: {
          type: 'debug-chunk',
          recordId: 'r',
          chunk: bytesToBase64(encode(`${index + 2}:D{"time":${index}}\n`)),
        },
      });
      await vi.advanceTimersByTimeAsync(20);
    }
    expect(parse).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(50);
    expect(parse).toHaveBeenCalledTimes(2);
    store.dispose();
  });
  it('resets records or preserves prior generations without mixing reused IDs', async () => {
    const store = createPanelStore({ ...empty, records: [wireRecord('r', { chunks: [bytes] })] });
    await vi.runAllTimersAsync();
    store.setOptions({ preserve: true });
    store.update({ type: 'reset', url: 'https://new.test' });
    store.update({ type: 'event', event: start('r') });
    store.update({ type: 'event', event: { type: 'record-chunk', id: 'r', chunk: bytes } });
    expect(store.getSnapshot().records.map((record) => record.key)).toEqual(['0:r', '1:r']);
    expect(store.getSnapshot().records[0]?.chunks).toHaveLength(1);
    store.setOptions({ preserve: false });
    store.update({ type: 'reset', url: empty.url });
    expect(store.getSnapshot()).toMatchObject({
      records: [],
      selected: null,
      parsed: null,
      parsing: false,
      parseError: null,
    });
    store.dispose();
  });
  it('clears pending parse state on reset and ignores stale asynchronous completion', async () => {
    let resolve: (value: ParsedRecord) => void = () => {};
    const result = new Promise<ParsedRecord>((done) => {
      resolve = done;
    });
    const parse = vi.fn(() => result);
    const store = createPanelStore(
      { ...empty, records: [wireRecord('r', { chunks: [bytes] })] },
      { parse },
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getSnapshot().parsing).toBe(true);
    store.update({ type: 'reset', url: empty.url });
    expect(store.getSnapshot().parsing).toBe(false);
    resolve(parseRecord({ ...wireRecord(), chunks: [encode('0:1\n')], debugChunks: [] }));
    await vi.runAllTimersAsync();
    expect(store.getSnapshot()).toMatchObject({ selected: null, parsed: null, parsing: false });
    store.dispose();
  });
  it('caches parse failures and supports default prefetch filters, clear, and subscriptions', async () => {
    const parse = vi.fn(() => {
      throw Error('bad payload');
    });
    const store = createPanelStore(
      { ...empty, records: [wireRecord('r', { chunks: [bytes] })] },
      { parse },
    );
    const notify = vi.fn();
    const unsubscribe = store.subscribe(notify);
    await vi.runAllTimersAsync();
    expect(store.getSnapshot().parseError).toContain('bad payload');
    store.select('0:r');
    await vi.runAllTimersAsync();
    expect(parse).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().hidePrefetch).toBe(true);
    expect(
      isPrefetch(
        captureRecord('p', { kind: 'pages-data', requestHeaders: { Purpose: 'prefetch' } }),
      ),
    ).toBe(true);
    expect(
      isPrefetch(captureRecord('p', { requestHeaders: { 'x-middleware-prefetch': '1' } })),
    ).toBe(true);
    store.clear();
    expect(store.getSnapshot().records).toEqual([]);
    expect(notify).toHaveBeenCalled();
    unsubscribe();
    store.dispose();
  });
});
