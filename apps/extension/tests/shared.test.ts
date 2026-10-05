import { describe, expect, it } from 'vitest';
import { actionStateFor } from '../src/background/action-state';
import { base64ToBytes, bytesToBase64 } from '../src/shared/base64';
import { classifyRequest } from '../src/shared/classify';
import { type DetectInput, detectNext } from '../src/shared/detect';
import { isHookEvent } from '../src/shared/validate';

const empty: DetectInput = { hasNextData: false, hasNextF: false, hasNextStatic: false };
describe('Next detection priority', () => {
  it.each([
    [
      { windowNext: { appDir: true }, hasNextData: true, hasNextF: true, hasNextStatic: true },
      'app',
    ],
    [{ windowNext: {}, hasNextData: true, hasNextF: true }, 'pages'],
    [{ hasNextF: true, windowNext: {} }, 'app'],
    [{ windowNext: {} }, 'unknown'],
    [{ hasNextStatic: true }, 'unknown'],
    [{}, null],
  ] as const)('matches %j', (input, router) => {
    expect(detectNext({ ...empty, ...input })).toMatchObject({ router, isNext: router !== null });
  });
  it('includes all true signals and only string versions/build IDs', () => {
    expect(
      detectNext({
        ...empty,
        hasNextData: true,
        hasNextF: true,
        hasNextStatic: true,
        windowNext: { appDir: true, version: '16.3.8' },
        nextDataBuildId: 'abc',
      }),
    ).toEqual({
      isNext: true,
      router: 'app',
      version: '16.3.8',
      buildId: 'abc',
      signals: ['window.next.appDir', '__NEXT_DATA__', '__next_f', 'window.next', '/_next/static'],
    });
    expect(
      detectNext({ ...empty, windowNext: { appDir: 'true', version: 16 } }).version,
    ).toBeUndefined();
  });
});
describe('Request classification', () => {
  it.each([
    [{ 'Next-Action': 'id', RSC: '1', 'Next-Router-Prefetch': '1' }, 'action'],
    [{ 'Next-Router-Prefetch': '1', RSC: '1' }, 'prefetch'],
    [{ 'Next-Router-Segment-Prefetch': '/_tree' }, 'prefetch'],
    [{ RSC: '1' }, 'navigation'],
    [{}, 'rsc'],
  ])('uses priority for %j', (requestHeaders, kind) => {
    expect(
      classifyRequest({
        url: 'https://demo.test/',
        requestHeaders,
        responseHeaders: { 'Content-Type': 'Text/X-Component; charset=utf-8' },
      }),
    ).toBe(kind);
  });
  it('captures JSON data routes only and ignores other response types', () => {
    const classify = (url: string, type: string) =>
      classifyRequest({ url, requestHeaders: {}, responseHeaders: { 'content-type': type } });
    expect(classify('/_next/data/build/legacy.json', 'application/json')).toBe('pages-data');
    expect(classify('/api', 'application/json')).toBeNull();
    expect(classify('/_next/data/build/legacy.json', 'text/html')).toBeNull();
    expect(classify('/', 'text/html')).toBeNull();
  });
});
describe('Toolbar action state (no badge text)', () => {
  it.each([
    [null, 'gray', 'Next.js DevTools — Next.js not detected'],
    [
      { isNext: false, router: null, signals: [] },
      'gray',
      'Next.js DevTools — Next.js not detected',
    ],
    [
      { isNext: true, router: 'app', version: '16.3.8', signals: [] },
      'black',
      'Next.js 16.3.8 — App Router',
    ],
    [
      { isNext: true, router: 'pages', version: '14', signals: [] },
      'black',
      'Next.js 14 — Pages Router',
    ],
    [{ isNext: true, router: 'unknown', version: '15', signals: [] }, 'black', 'Next.js 15'],
    [{ isNext: true, router: 'app', signals: [] }, 'black', 'Next.js — App Router'],
  ] as const)('renders %j', (detection, iconSet, title) => {
    expect(actionStateFor(detection === null ? null : { ...detection, signals: [] })).toEqual({
      iconSet,
      title,
    });
  });
});
it('round trips a large byte array without argument-stack overflow', () => {
  const bytes = Uint8Array.from({ length: 2 * 1024 * 1024 + 7 }, (_, i) => i % 256);
  const roundTrip = base64ToBytes(bytesToBase64(bytes));
  // Compare bytes directly: element-wise toEqual on 2 MB takes seconds and timed out in CI.
  expect(roundTrip.length).toBe(bytes.length);
  expect(Buffer.compare(Buffer.from(roundTrip), Buffer.from(bytes))).toBe(0);
  expect(base64ToBytes(bytesToBase64(new Uint8Array()))).toEqual(new Uint8Array());
});
it('validates debug and metadata messages while rejecting unrelated/malformed messages', () => {
  expect(isHookEvent({ type: 'debug-chunk', requestId: 'id', chunk: Uint8Array.of(1) })).toBe(true);
  expect(isHookEvent({ type: 'debug-chunk', requestId: 'id', chunk: null })).toBe(true);
  expect(isHookEvent({ type: 'debug-chunk', requestId: 1, chunk: 'bad' })).toBe(false);
  expect(isHookEvent({ type: 'record-meta', id: 'r', patch: { requestId: 1 } })).toBe(false);
  expect(isHookEvent({ type: 'dump' })).toBe(false);
});
