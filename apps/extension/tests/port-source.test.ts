import { afterEach, expect, it, vi } from 'vitest';
import { createPortSource } from '../src/panel/portSource';
import type { BackgroundToPanelMessage } from '../src/shared/messages';
import { start, wireRecord } from './helpers';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('attaches, handles snapshots/events/reset, reconnects after one second, and detaches on disposal', async () => {
  vi.useFakeTimers();
  function port() {
    const messages: ((message: BackgroundToPanelMessage) => void)[] = [];
    const disconnects: (() => void)[] = [];
    return {
      messages,
      disconnects,
      onMessage: {
        addListener: (fn: (message: BackgroundToPanelMessage) => void) => messages.push(fn),
      },
      onDisconnect: { addListener: (fn: () => void) => disconnects.push(fn) },
      postMessage: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  const first = port(),
    second = port();
  const connect = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
  vi.stubGlobal('chrome', { runtime: { connect }, devtools: { inspectedWindow: { tabId: 37 } } });
  const source = createPortSource();
  const listener = vi.fn();
  const dispose = source.subscribe(listener);
  expect(connect).toHaveBeenCalledWith({ name: 'panel' });
  expect(first.postMessage).toHaveBeenCalledWith({ type: 'attach', tabId: 37 });
  const receive = (message: BackgroundToPanelMessage) => {
    for (const fn of first.messages) fn(message);
  };
  receive({ type: 'snapshot', url: 'https://demo.test', records: [wireRecord('a')] });
  receive({ type: 'detect', detection: { isNext: true, router: 'app', signals: [] } });
  receive({ type: 'event', event: start('b') });
  receive({ type: 'event', event: { type: 'debug-chunk', recordId: 'b', chunk: 'YQ==' } });
  receive({ type: 'event', event: { type: 'debug-chunk', recordId: 'b', chunk: null } });
  expect(source.snapshot().records.find((r) => r.id === 'b')).toMatchObject({
    debugChunks: ['YQ=='],
    debugDone: true,
  });
  expect(source.snapshot().detection?.router).toBe('app');
  receive({ type: 'reset', url: 'https://new.test' });
  expect(source.snapshot()).toEqual({ url: 'https://new.test', records: [], detection: null });
  expect(listener).toHaveBeenCalledTimes(6);
  for (const disconnect of first.disconnects) disconnect();
  await vi.advanceTimersByTimeAsync(999);
  expect(connect).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(connect).toHaveBeenCalledTimes(2);
  expect(second.postMessage).toHaveBeenCalledWith({ type: 'attach', tabId: 37 });
  dispose();
  expect(second.disconnect).toHaveBeenCalledOnce();
  await vi.runAllTimersAsync();
  expect(connect).toHaveBeenCalledTimes(2);
});
