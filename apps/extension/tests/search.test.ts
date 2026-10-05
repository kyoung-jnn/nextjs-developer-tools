import { decodeJson, type ParsedRow } from '@nextjs-devtools/flight-parser';
import { describe, expect, it } from 'vitest';
import {
  ancestorPaths,
  pathKey,
  searchRows,
  searchText,
  searchValue,
} from '../src/panel/search/matchers';

describe('value search', () => {
  it('matches keys and primitive values once per displayed node', () => {
    expect(
      searchValue({ needle: 'needle', nested: { n: 42, yes: true, empty: null } }, 'needle'),
    ).toEqual({ paths: [['needle']], count: 1, limited: false, visited: 6 });
    expect(searchValue({ nested: { n: 42, yes: true, empty: null } }, '42').paths).toEqual([
      ['nested', 'n'],
    ]);
    expect(searchValue(true, 'true').paths).toEqual([[]]);
    expect(searchValue(null, 'null').paths).toEqual([[]]);
    expect(searchValue({ x: 'hello' }, '').count).toBe(0);
  });
  it('matches Flight special and reference displays without exposing marker internals', () => {
    const value = decodeJson({ date: '$D2026-10-05', symbol: '$Sreact.fragment', ref: '$Laf' });
    expect(searchValue(value, 'Date(2026').paths).toEqual([['date']]);
    expect(searchValue(value, 'Symbol(react').paths).toEqual([['symbol']]);
    expect(searchValue(value, '$Laf').paths).toEqual([['ref']]);
    expect(searchValue(value, '$flight').count).toBe(0);
  });
  it('matches dates using the active display formatter', () => {
    const date = decodeJson('$D2026-10-05T00:00:00.000Z');
    expect(
      searchValue(date, 'Date(local timestamp)', { formatDate: () => 'local timestamp' }).paths,
    ).toEqual([[]]);
    expect(searchValue(date, '2026-10-05', { formatDate: () => 'local timestamp' }).count).toBe(0);
  });
  it('uses the same element projection as JsonTree', () => {
    const element = decodeJson(['$', 'div', 'item', { children: 'target' }, 'owner']);
    expect(searchValue(element, 'target').paths).toEqual([['props', 'children']]);
    expect(searchValue(element, 'owner').paths).toEqual([['extra', '0']]);
    expect(searchValue(element, 'element').count).toBe(0);
  });
  it('defaults to insensitive matching and supports case sensitivity', () => {
    expect(searchValue({ Hello: 'WORLD' }, 'hello').count).toBe(1);
    expect(searchValue({ Hello: 'WORLD' }, 'world', { caseSensitive: true }).count).toBe(0);
  });
  it('searches beyond initial array pages and marks exhausted budgets', () => {
    const values = Array.from({ length: 1000 }, (_, i) => (i === 999 ? 'needle' : 'hay'));
    expect(searchValue(values, 'needle').paths).toEqual([['999']]);
    expect(searchValue(values, 'hay', { budget: 3 })).toEqual({
      paths: [['0'], ['1']],
      count: 2,
      limited: true,
      visited: 3,
    });
    expect(searchValue(['needle'], 'needle', { budget: 2 }).limited).toBe(false);
    expect(searchValue(values, 'needle', { budget: 0 }).limited).toBe(true);
  });
  it('bounds cycles while still searching shared objects at every visible path', () => {
    const shared = { text: 'needle' };
    const cyclic: Record<string, unknown> = { a: shared, b: shared };
    cyclic.self = cyclic;
    expect(searchValue(cyclic, 'needle').paths).toEqual([
      ['a', 'text'],
      ['b', 'text'],
    ]);
  });
  it('does not access descendants after the node budget is exhausted', () => {
    let accessed = false;
    const value = {
      get child() {
        accessed = true;
        return 'needle';
      },
    };
    expect(searchValue(value, 'needle', { budget: 1 }).limited).toBe(true);
    expect(accessed).toBe(false);
  });
  it('does not throw on inaccessible properties', () => {
    const value = {
      good: 'needle',
      get bad(): never {
        throw new Error('unavailable');
      },
    };
    expect(() => searchValue(value, 'needle')).not.toThrow();
    expect(searchValue(value, 'needle').paths).toEqual([['good']]);
  });
});

describe('search paths', () => {
  it('escapes path segments without collisions and includes own paths and ancestors', () => {
    const path = ['a.b', 'quote"\\', ''];
    expect(pathKey(path)).toBe(JSON.stringify(path));
    expect(pathKey(['a.b'])).not.toBe(pathKey(['a', 'b']));
    expect(ancestorPaths([path])).toEqual(
      new Set([pathKey([]), pathKey(['a.b']), pathKey(['a.b', 'quote"\\']), pathKey(path)]),
    );
    expect(ancestorPaths([]).size).toBe(0);
  });
});

describe('text search', () => {
  it('returns non-overlapping UTF16 ranges and treats regex punctuation literally', () => {
    expect(searchText('aaaaa', 'aa')).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ]);
    expect(searchText('🙂 [x] [X]', '[x]')).toEqual([
      { start: 3, end: 6 },
      { start: 7, end: 10 },
    ]);
    expect(searchText('Hello HELLO', 'hello', { caseSensitive: true })).toEqual([]);
    expect(searchText('hello', '')).toEqual([]);
    expect(searchText('aaaaaa', 'a', { budget: 2 })).toEqual([
      { start: 0, end: 1 },
      { start: 1, end: 2 },
    ]);
  });
  it('preserves original offsets when Unicode lowercasing changes length', () => {
    expect(searchText('İ abc ABC', 'abc')).toEqual([
      { start: 2, end: 5 },
      { start: 6, end: 9 },
    ]);
    expect(searchText('İİ', 'i')).toEqual([
      { start: 0, end: 1 },
      { start: 1, end: 2 },
    ]);
    expect(searchText('🙂İabc', 'abc')).toEqual([{ start: 3, end: 6 }]);
  });
});

describe('row search', () => {
  const rows: ParsedRow[] = [
    { id: 175, tag: 'I', kind: 'module', text: 'bundle', byteLength: 6 },
    {
      id: 2,
      tag: '',
      kind: 'model',
      text: '"$D2026-10-05"',
      value: decodeJson('$D2026-10-05'),
      byteLength: 10,
    },
    { id: 3, tag: 'T', kind: 'text', text: 'Hello', byteLength: 5 },
  ];
  it('matches hex ids, tags, kinds, raw text and decoded displays in original order', () => {
    expect(searchRows(rows, 'af')).toEqual([0]);
    expect(searchRows(rows, 'module')).toEqual([0]);
    expect(searchRows(rows, 'T', { caseSensitive: true })).toEqual([2]);
    expect(searchRows(rows, 'bundle')).toEqual([0]);
    expect(searchRows(rows, 'Date(2026')).toEqual([1]);
    expect(searchRows(rows, 'hello')).toEqual([2]);
    expect(searchRows(rows, '')).toEqual([]);
  });
});
