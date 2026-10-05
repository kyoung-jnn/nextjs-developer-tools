import { describe, expect, it, vi } from 'vitest';
import { createFetchHook } from '../src/content/fetch-hook';
import { RecordBuffer } from '../src/content/record-buffer';
import type { HookEvent } from '../src/shared/messages';
import { encode, start } from './helpers';

describe('capture settings', () => {
  it('applies lower limits to existing records and accounts for removed debug bytes', () => {
    const buffer = new RecordBuffer();
    buffer.apply(start('first', 'request'));
    buffer.apply({ type: 'debug-chunk', requestId: 'request', chunk: encode('1234') });
    buffer.apply(start('second'));
    buffer.apply({ type: 'record-chunk', id: 'second', chunk: encode('12') });
    expect(buffer.configure({ records: 1, totalBytes: 3 }).evicted).toBe(true);
    expect(buffer.snapshot().map((record) => record.id)).toEqual(['second']);
    expect(buffer.apply({ type: 'record-chunk', id: 'second', chunk: encode('3') }).evicted).toBe(
      false,
    );
    expect(buffer.apply({ type: 'record-chunk', id: 'second', chunk: encode('4') }).evicted).toBe(
      true,
    );
    expect(buffer.snapshot()).toEqual([]);
  });

  it('supports the settings count range beyond the default 300 records', () => {
    const buffer = new RecordBuffer();
    buffer.configure({ records: 1000, totalBytes: 200 * 1024 * 1024 });
    for (let index = 0; index < 1000; index++) buffer.apply(start(String(index)));
    expect(buffer.snapshot()).toHaveLength(1000);
    buffer.configure({ records: 50 });
    expect(buffer.snapshot()).toHaveLength(50);
    expect(buffer.snapshot()[0]?.id).toBe('950');
  });

  it('removes prefetches captured before settings load and drops subsequent events', () => {
    const buffer = new RecordBuffer();
    const prefetch = start('prefetch', 'prefetch-request');
    prefetch.record.kind = 'prefetch';
    buffer.apply(prefetch);
    buffer.apply({ type: 'record-chunk', id: 'prefetch', chunk: encode('early') });
    buffer.apply(start('document', 'document-request'));
    expect(buffer.configure({ capturePrefetch: false }).evicted).toBe(true);
    expect(buffer.snapshot().map((record) => record.id)).toEqual(['document']);
    expect(buffer.apply(prefetch).events).toEqual([]);
    expect(
      buffer.apply({ type: 'record-chunk', id: 'prefetch', chunk: encode('late') }).events,
    ).toEqual([]);
    buffer.apply({ type: 'debug-chunk', requestId: 'prefetch-request', chunk: encode('debug') });
    buffer.apply({
      type: 'debug-chunk',
      requestId: 'document-request',
      chunk: encode('server IO'),
    });
    expect(buffer.summary()[0]?.debugByteLength).toBe(9);
  });

  it.each([
    'x-middleware-prefetch',
    'next-router-prefetch',
    'next-router-segment-prefetch',
    'purpose',
    'sec-purpose',
  ])('filters Pages data using the %s request header', (header) => {
    const buffer = new RecordBuffer();
    buffer.configure({ capturePrefetch: false });
    const event = start('pages');
    event.record.kind = 'pages-data';
    event.record.requestHeaders = { [header]: header.includes('purpose') ? 'prefetch' : '1' };
    expect(buffer.apply(event).events).toEqual([]);
    expect(buffer.snapshot()).toEqual([]);
  });

  it('removes a record when late metadata identifies it as a prefetch', () => {
    const buffer = new RecordBuffer();
    buffer.configure({ capturePrefetch: false });
    buffer.apply(start());
    expect(
      buffer.apply({
        type: 'record-meta',
        id: 'record',
        patch: { requestHeaders: { purpose: 'prefetch' } },
      }),
    ).toEqual({ events: [], evicted: true });
    expect(buffer.snapshot()).toEqual([]);
  });

  it('reads the dynamic hook flag while preserving fetch responses and navigation capture', async () => {
    let capturePrefetch = false;
    const events: HookEvent[] = [];
    const original = vi.fn<typeof fetch>(
      async () => new Response('body', { headers: { 'content-type': 'text/x-component' } }),
    );
    const hook = createFetchHook(original, {
      emit: (event) => events.push(event),
      nextId: () => String(events.length),
      baseUrl: () => 'https://demo.test/',
      capturePrefetch: () => capturePrefetch,
    });
    const response = await hook('/', { headers: { 'next-router-prefetch': '1' } });
    expect(await response.text()).toBe('body');
    expect(events).toEqual([]);
    await hook('/', { headers: { rsc: '1' } });
    expect(events.find((event) => event.type === 'record-start')).toMatchObject({
      record: { kind: 'navigation' },
    });
    capturePrefetch = true;
    await hook('/', { headers: { 'next-router-prefetch': '1' } });
    expect(
      events.some((event) => event.type === 'record-start' && event.record.kind === 'prefetch'),
    ).toBe(true);
  });

  it('skips Pages data prefetches without consuming their responses', async () => {
    const emit = vi.fn();
    const hook = createFetchHook(
      async () => new Response('{}', { headers: { 'content-type': 'application/json' } }),
      {
        emit,
        nextId: () => 'pages',
        baseUrl: () => 'https://demo.test/',
        capturePrefetch: () => false,
      },
    );
    const response = await hook('/_next/data/build/page.json', {
      headers: { 'x-middleware-prefetch': '1' },
    });
    expect(await response.text()).toBe('{}');
    expect(emit).not.toHaveBeenCalled();
  });
});
