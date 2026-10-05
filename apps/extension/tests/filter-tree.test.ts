import { decodeJson } from '@nextjs-devtools/flight-parser';
import { describe, expect, it } from 'vitest';
import { filterTree } from '../src/panel/search/filterTree';
import { pathKey } from '../src/panel/search/matchers';

const keys = (paths: string[][]) => new Set(paths.map(pathKey));

describe('filterTree', () => {
  it('keeps matching values and ancestors and removes nonmatching siblings', () => {
    const result = filterTree(
      { user: { name: 'Zoë', tags: ['staff'], friend: 'Renée' }, unrelated: true },
      [['user', 'name']],
      [],
    );
    expect(result.visible).toEqual(keys([[], ['user'], ['user', 'name']]));
    expect(result.hiddenCounts).toEqual(
      new Map([
        [pathKey([]), 1],
        [pathKey(['user']), 2],
      ]),
    );
  });
  it('keeps the full subtree of a matched key', () => {
    const result = filterTree(
      { tags: ['one', { two: 'three' }], sibling: false },
      [['tags']],
      [['tags']],
    );
    expect(result.visible).toEqual(
      keys([[], ['tags'], ['tags', '0'], ['tags', '1'], ['tags', '1', 'two']]),
    );
    expect(result.hiddenCounts).toEqual(new Map([[pathKey([]), 1]]));
  });
  it('keeps all matched branches, array index identities and escaped keys', () => {
    const result = filterTree(
      { 'a.b': [{ name: 'hay' }, { 'q"': 'needle', other: false }] },
      [['a.b', '1', 'q"']],
      [],
    );
    expect(result.visible).toEqual(keys([[], ['a.b'], ['a.b', '1'], ['a.b', '1', 'q"']]));
    expect(result.hiddenCounts.get(pathKey(['a.b']))).toBe(1);
    expect(result.hiddenCounts.get(pathKey(['a.b', '1']))).toBe(1);
  });
  it('uses JsonTree element projection and treats Flight markers as leaves', () => {
    const element = decodeJson(['$', 'div', null, { special: '$D2026-10-05', unrelated: true }]);
    const result = filterTree(element, [['props', 'special']], []);
    expect(result.visible).toEqual(keys([[], ['props'], ['props', 'special']]));
    expect(result.hiddenCounts.get(pathKey([]))).toBe(3);
    expect(result.hiddenCounts.has(pathKey(['props', 'special']))).toBe(false);
  });
  it('handles no matches and primitive root matches', () => {
    expect(filterTree({ a: 1, b: 2 }, [], []).visible.size).toBe(0);
    expect(filterTree({ a: 1, b: 2 }, [], []).hiddenCounts.get(pathKey([]))).toBe(2);
    expect(filterTree('needle', [[]], []).visible).toEqual(keys([[]]));
  });
  it('bounds cycles while preserving shared subtrees at both paths', () => {
    const shared = { child: 'value' };
    const root: Record<string, unknown> = { a: shared, b: shared };
    root.self = root;
    const result = filterTree(root, [[]], [[]]);
    expect(result.visible).toEqual(
      keys([[], ['a'], ['a', 'child'], ['b'], ['b', 'child'], ['self']]),
    );
    expect(result.limited).toBe(false);
  });
  it('handles inaccessible properties safely', () => {
    const value = {
      good: 'needle',
      get bad(): never {
        throw new Error('no access');
      },
    };
    expect(() => filterTree(value, [[]], [[]])).not.toThrow();
    expect(filterTree(value, [[]], [[]]).visible.has(pathKey(['good']))).toBe(true);
  });
});
