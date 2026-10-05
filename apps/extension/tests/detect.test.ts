import { describe, expect, it, vi } from 'vitest';
import { createWebSocketHook } from '../src/content/websocket-hook';
import { type DetectInput, detectNext } from '../src/shared/detect';
import { isDetection } from '../src/shared/validate';

const empty: DetectInput = { hasNextData: false, hasNextF: false, hasNextStatic: false };
describe('Next build mode detection', () => {
  it.each([
    [{ hasNextData: true, nextDataBuildId: 'development' }, 'dev:buildId'],
    [{ hasNextF: true, hasHmr: true }, 'dev:hmr'],
    [{ hasNextStatic: true, hasDevOverlay: true }, 'dev:overlay'],
  ])('detects development from %j', (input, signal) => {
    expect(detectNext({ ...empty, ...input })).toMatchObject({ mode: 'development' });
    expect(detectNext({ ...empty, ...input }).signals).toContain(signal);
  });
  it('waits until the final pass to infer production', () => {
    expect(detectNext({ ...empty, hasNextF: true }).mode).toBeUndefined();
    expect(detectNext({ ...empty, hasNextF: true, final: true }).mode).toBe('production');
    expect(detectNext({ ...empty, final: true }).mode).toBeUndefined();
  });
  it('lets late HMR override inferred production and retains every dev signal', () => {
    expect(detectNext({ ...empty, hasNextF: true, final: true, hasHmr: true }).mode).toBe(
      'development',
    );
    expect(
      detectNext({
        ...empty,
        hasNextData: true,
        nextDataBuildId: 'development',
        hasHmr: true,
        hasDevOverlay: true,
      }).signals,
    ).toEqual(['__NEXT_DATA__', 'dev:buildId', 'dev:hmr', 'dev:overlay']);
  });
  it('does not classify unrelated pages from dev hints alone', () => {
    expect(detectNext({ ...empty, hasHmr: true, hasDevOverlay: true, final: true })).toMatchObject({
      isNext: false,
      router: null,
    });
  });
  it('validates only supported optional modes', () => {
    const detection = { isNext: true, router: 'app', signals: [] };
    expect(isDetection(detection)).toBe(true);
    expect(isDetection({ ...detection, mode: 'development' })).toBe(true);
    expect(isDetection({ ...detection, mode: 'production' })).toBe(true);
    expect(isDetection({ ...detection, mode: 'staging' })).toBe(false);
  });
});

class Socket extends EventTarget {
  constructor(readonly url: string) {
    super();
    if (url === 'invalid') throw Error('invalid URL');
  }
}
it('reports HMR constructor observation without altering socket behavior', () => {
  const onHmr = vi.fn();
  const hook = createWebSocketHook(Socket as unknown as typeof WebSocket, () => {}, onHmr);
  const normal = new hook('ws://host/chat');
  new hook('ws://host/_next/other');
  expect(onHmr).not.toHaveBeenCalled();
  const hmr = new hook('ws://host/_next/webpack-hmr');
  expect(onHmr).toHaveBeenCalledTimes(1);
  expect(hmr).toBeInstanceOf(Socket);
  expect(normal).toBeInstanceOf(Socket);
  expect(() => new hook('invalid')).toThrow('invalid URL');
  expect(onHmr).toHaveBeenCalledTimes(1);
});
