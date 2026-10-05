import { describe, expect, it, vi } from 'vitest';
import { createFetchHook } from '../src/content/fetch-hook';
import type { HookEvent } from '../src/shared/messages';
import { encode } from './helpers';

async function captured(input: RequestInfo | URL, init?: RequestInit, type = 'text/x-component') {
  const events: HookEvent[] = [];
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encode('first café —'));
        controller.enqueue(encode(' 👋 last'));
        controller.close();
      },
    }),
    { headers: { 'content-type': type }, status: 200 },
  );
  let finish: () => void = () => {};
  const ended = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const original = vi.fn<typeof fetch>(async () => response);
  const hooked = createFetchHook(original, {
    emit: (event) => {
      events.push(event);
      if (event.type === 'record-end') finish();
    },
    nextId: () => 'id',
    baseUrl: () => 'https://demo.test/action',
    now: () => 123,
  });
  const receiver = {};
  const result = await hooked.call(receiver, input, init);
  expect(result).toBe(response);
  expect(original).toHaveBeenCalledWith(input, init);
  expect(original.mock.contexts[0]).toBe(receiver);
  expect(await result.text()).toBe('first café — 👋 last');
  if (type === 'text/x-component') await ended;
  return events;
}
describe('fetch observation', () => {
  it.each([
    [
      new Request('https://demo.test/', {
        headers: { rsc: '1', 'x-nextjs-request-id': 'next-id' },
      }),
      undefined,
      'navigation',
    ],
    ['/', { headers: new Headers({ 'next-router-prefetch': '1', rsc: '1' }) }, 'prefetch'],
    ['', { method: 'POST', headers: [['next-action', 'action-id']] }, 'action'],
    ['/', { headers: {} }, 'rsc'],
  ] satisfies [RequestInfo, RequestInit | undefined, string][])(
    'classifies request %s without consuming the original body',
    async (input, init, kind) => {
      const events = await captured(input, init);
      const started = events.find((event) => event.type === 'record-start');
      expect(started?.record.kind).toBe(kind);
      expect(started?.record.startTime).toBe(123);
      expect(events.find((event) => event.type === 'record-meta')).toMatchObject({
        patch: { status: 200, responseHeaders: { 'content-type': 'text/x-component' } },
      });
      const chunks = events
        .filter((event) => event.type === 'record-chunk')
        .map((event) => event.chunk);
      expect(
        new TextDecoder().decode(Uint8Array.from(chunks.flatMap((chunk) => Array.from(chunk)))),
      ).toBe('first café — 👋 last');
      expect(events.at(-1)).toEqual({ type: 'record-end', id: 'id', endTime: 123 });
      if (kind === 'navigation') expect(started?.record.requestId).toBe('next-id');
      if (kind === 'action')
        expect(started?.record).toMatchObject({ url: 'https://demo.test/action', method: 'POST' });
    },
  );
  it('leaves non-RSC responses uncaptured and preserves fetch rejection', async () => {
    expect(await captured('/api', undefined, 'application/json')).toEqual([]);
    const failure = Error('network');
    const original = vi.fn<typeof fetch>(async () => {
      throw failure;
    });
    const hook = createFetchHook(original, { emit: vi.fn(), nextId: () => '', baseUrl: () => '' });
    await expect(hook('/')).rejects.toBe(failure);
  });
  it('returns before the cloned body ends and isolates observer/clone failures', async () => {
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(value) {
          controller = value;
        },
      }),
      { headers: { 'content-type': 'text/x-component' } },
    );
    const hook = createFetchHook(async () => response, {
      emit: () => {
        throw Error('observer');
      },
      nextId: () => '',
      baseUrl: () => 'https://demo.test/',
    });
    expect(await hook('/')).toBe(response);
    controller?.enqueue(encode('body'));
    controller?.close();
    expect(await response.text()).toBe('body');
    const events: HookEvent[] = [];
    const consumed = new Response('consumed', { headers: { 'content-type': 'text/x-component' } });
    await consumed.text();
    const broken = createFetchHook(async () => consumed, {
      emit: (event) => events.push(event),
      nextId: () => 'broken',
      baseUrl: () => 'https://demo.test/',
    });
    expect(await broken('/')).toBe(consumed);
    await vi.waitFor(() =>
      expect(events.at(-1)).toMatchObject({ type: 'record-end', error: expect.any(String) }),
    );
  });
});
