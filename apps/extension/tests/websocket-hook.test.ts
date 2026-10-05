import { describe, expect, it, vi } from 'vitest';
import { createWebSocketHook, decodeDebugFrame } from '../src/content/websocket-hook';
import type { HookEvent } from '../src/shared/messages';
import { encode } from './helpers';

class Socket extends EventTarget {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;
  constructor(
    readonly url: string,
    readonly protocols?: string | string[],
  ) {
    super();
    if (url === 'invalid') throw Error('invalid URL');
  }
  message(data: unknown) {
    const event = new Event('message');
    Object.defineProperty(event, 'data', { value: data });
    this.dispatchEvent(event);
  }
}
const frame = (id: string, text: string) => {
  const name = encode(id),
    chunk = encode(text);
  return Uint8Array.from([0, name.length, ...name, ...chunk]);
};
const ctor = Socket as unknown as typeof WebSocket;
describe('Next debug WebSocket observation', () => {
  it('preserves prototype, instanceof, subclassing, static constants, protocols and failures', () => {
    const hook = createWebSocketHook(ctor, () => {});
    const socket = new hook('ws://host/_next/hmr', ['protocol']);
    expect(socket).toBeInstanceOf(hook);
    expect(socket).toBeInstanceOf(Socket);
    expect(hook.prototype).toBe(Socket.prototype);
    expect(hook.OPEN).toBe(Socket.OPEN);
    expect((socket as unknown as Socket).protocols).toEqual(['protocol']);
    class Derived extends hook {}
    expect(new Derived('ws://host/socket')).toBeInstanceOf(Derived);
    expect(() => new hook('invalid')).toThrow('invalid URL');
    expect(() => Reflect.apply(hook, undefined, ['ws://host/'])).toThrow();
  });
  it('observes only Next sockets and ignores text, other binary types and malformed frames', async () => {
    const emit = vi.fn();
    const hook = createWebSocketHook(ctor, emit);
    const other = new hook('ws://host/chat') as unknown as Socket;
    other.message(frame('q', 'wrong').buffer);
    const next = new hook('ws://host/_next/webpack-hmr') as unknown as Socket;
    const pageListener = vi.fn();
    next.addEventListener('message', pageListener);
    next.message('hmr JSON');
    next.message(Uint8Array.of(1, 1, 65, 42).buffer);
    next.message(Uint8Array.of(0, 8, 65).buffer);
    next.message(frame('q', 'right').buffer);
    await vi.waitFor(() => expect(emit).toHaveBeenCalledTimes(1));
    expect(emit).toHaveBeenCalledWith({
      type: 'debug-chunk',
      requestId: 'q',
      chunk: encode('right'),
    });
    expect(pageListener).toHaveBeenCalledTimes(4);
    expect(decodeDebugFrame(Uint8Array.of(0))).toBeNull();
    expect(decodeDebugFrame(Uint8Array.of(0, 0))).toBeNull();
  });
  it('reports HMR sockets without treating unrelated sockets as development signals', () => {
    const onHmr = vi.fn();
    const hook = createWebSocketHook(ctor, () => {}, onHmr);
    new hook('ws://host/chat');
    new hook('ws://host/_next/other');
    expect(onHmr).not.toHaveBeenCalled();
    const socket = new hook('ws://host/_next/webpack-hmr');
    expect(onHmr).toHaveBeenCalledTimes(1);
    expect(socket).toBeInstanceOf(Socket);
    const throwing = createWebSocketHook(
      ctor,
      () => {},
      () => {
        throw Error('mode observer');
      },
    );
    expect(() => new throwing('ws://host/_next/webpack-hmr')).not.toThrow();
  });
  it('serializes delayed Blob and ArrayBuffer frames and emits null for completion', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    class DelayedBlob extends Blob {
      override async arrayBuffer() {
        await gate;
        return super.arrayBuffer();
      }
    }
    const events: Extract<HookEvent, { type: 'debug-chunk' }>[] = [];
    const hook = createWebSocketHook(ctor, (event) => events.push(event));
    const socket = new hook('ws://host/_next/hmr') as unknown as Socket;
    socket.message(new DelayedBlob([frame('café—👋', 'first')]));
    socket.message(frame('café—👋', 'second').buffer);
    socket.message(new Blob([frame('café—👋', '')]));
    await Promise.resolve();
    expect(events).toEqual([]);
    release();
    await vi.waitFor(() => expect(events).toHaveLength(3));
    expect(
      events.map((event) => (event.chunk ? new TextDecoder().decode(event.chunk) : null)),
    ).toEqual(['first', 'second', null]);
    expect(events.map((event) => event.requestId)).toEqual(['café—👋', 'café—👋', 'café—👋']);
  });
  it('keeps processing after an observer throws', async () => {
    const emit = vi.fn().mockImplementationOnce(() => {
      throw Error('observer');
    });
    const hook = createWebSocketHook(ctor, emit);
    const socket = new hook('ws://host/_next/hmr') as unknown as Socket;
    expect(() => socket.message(frame('q', 'one').buffer)).not.toThrow();
    socket.message(frame('q', 'two').buffer);
    await vi.waitFor(() => expect(emit).toHaveBeenCalledTimes(2));
  });
});
