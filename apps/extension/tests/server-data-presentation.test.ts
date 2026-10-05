import { describe, expect, it } from 'vitest';
import { serializeServerData } from '../src/panel/ServerData';

describe('Server data clipboard', () => {
  it('renders special values as strings without losing ordinary JSON data', () => {
    expect(
      JSON.parse(
        serializeServerData({
          when: { $flight: 'special', kind: 'date', value: '2026-10-05T00:00:00.000Z' },
          missing: { $flight: 'special', kind: 'undefined' },
          posts: [{ id: 1, title: 'café — 👋' }],
        }),
      ),
    ).toEqual({
      when: 'date(2026-10-05T00:00:00.000Z)',
      missing: 'undefined',
      posts: [{ id: 1, title: 'café — 👋' }],
    });
  });
  it('keeps unresolved refs readable', () => {
    expect(
      JSON.parse(
        serializeServerData({ $flight: 'ref', kind: 'promise', id: 2, path: [], raw: '$@2' }),
      ),
    ).toBe('$@2');
  });
});
