import { segmentToBytes } from '@nextjs-devtools/flight-parser';
import { describe, expect, it, vi } from 'vitest';
import { installNextFHook } from '../src/content/next-f-hook';

describe('__next_f interception', () => {
  it('records inline pushes and later callback pushes after Next clears the array', () => {
    const target: { __next_f?: unknown[] } = {};
    const report = vi.fn();
    installNextFHook(target, report);
    expect(target.__next_f).toBeUndefined();
    // biome-ignore lint/suspicious/noAssignInExpressions: Reproduce Next's inline bootstrap assignment exactly.
    const array = (target.__next_f = target.__next_f || []);
    expect(array.push([0], [1, 'first'])).toBe(2);
    expect(report.mock.calls.map((call) => call[0])).toEqual([[0], [1, 'first']]);
    const callback = vi.fn(() => 73);
    array.forEach(callback);
    array.length = 0;
    array.push = callback;
    const b64 = [3, '8J+Riw=='];
    expect(array.push(b64)).toBe(73);
    expect(callback).toHaveBeenLastCalledWith(b64);
    expect(report).toHaveBeenCalledTimes(3);
    expect(array.length).toBe(0);
    expect(
      new TextDecoder().decode(segmentToBytes(report.mock.calls[2]?.[0]) ?? new Uint8Array()),
    ).toBe('👋');
    target.__next_f = array;
    expect(report).toHaveBeenCalledTimes(3);
  });
  it('observes existing items once, replacement arrays, and borrowed push receivers', () => {
    const target = { __next_f: [[1, 'existing']] };
    const seen: unknown[] = [];
    installNextFHook(target, (item) => seen.push(item));
    const original = target.__next_f;
    target.__next_f = original;
    target.__next_f = [[1, 'new']];
    const borrowed: unknown[] = [];
    expect(original.push.call(borrowed, [1, 'borrowed'])).toBe(1);
    expect(borrowed).toEqual([[1, 'borrowed']]);
    expect(seen).toEqual([
      [1, 'existing'],
      [1, 'new'],
      [1, 'borrowed'],
    ]);
  });
  it('never propagates observer errors or instrumentation failures', () => {
    const target: { __next_f?: unknown[] } = {};
    installNextFHook(target, () => {
      throw Error('observer');
    });
    target.__next_f = [];
    expect(() => target.__next_f?.push([0])).not.toThrow();
    const frozen = Object.freeze({ __next_f: Object.freeze([]) });
    expect(() => installNextFHook(frozen, () => {})).not.toThrow();
  });
});
