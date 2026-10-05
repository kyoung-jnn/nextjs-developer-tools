import { describe, expect, it } from 'vitest';
import { decodeJson, decodeString, isElement, isRef } from '../src/decode';

describe('Flight value decoding', () => {
  it.each([
    ['$a', 'model', 10],
    ['$L1', 'lazy', 1],
    ['$@2', 'promise', 2],
    ['$w3', 'weak-promise', 3],
    ['$h4', 'server-reference', 4],
    ['$F5', 'server-reference', 5],
    ['$Q6', 'map', 6],
    ['$W7', 'set', 7],
    ['$B8', 'blob', 8],
    ['$K9', 'form-data', 9],
    ['$Za', 'error', 10],
    ['$ib', 'iterator', 11],
    ['$Pc', 'debug', 12],
    ['$Ed', 'debug', 13],
    ['$Ye', 'debug', 14],
    ['$P', 'debug', -1],
    ['$E', 'debug', -1],
    ['$Y', 'debug', -1],
    ['$Topaque', 'temporary', -1],
  ])('decodes %s as a reference', (raw, kind, id) => {
    expect(decodeString(String(raw))).toMatchObject({ $flight: 'ref', kind, id });
  });
  it.each([
    ['$Sreact.suspense', 'symbol', 'react.suspense'],
    ['$u', 'undefined', undefined],
    ['$undefined', 'undefined', undefined],
    ['$NaN', 'NaN', undefined],
    ['$Infinity', 'Infinity', undefined],
    ['$I', 'Infinity', undefined],
    ['$-Infinity', '-Infinity', undefined],
    ['$-0', '-0', undefined],
    ['$D2026-10-05', 'date', '2026-10-05'],
    ['$n1234567890123456789', 'bigint', '1234567890123456789'],
  ])('decodes %s as a special value', (raw, kind, value) => {
    expect(decodeString(raw)).toEqual({
      $flight: 'special',
      kind,
      ...(value === undefined ? {} : { value }),
    });
  });
  it('keeps escapes, property paths and unknown markers safe', () => {
    expect(decodeString('$$L1')).toBe('$L1');
    expect(decodeString('$1:props:children')).toEqual({
      $flight: 'ref',
      kind: 'model',
      id: 1,
      path: ['props', 'children'],
      raw: '$1:props:children',
    });
    expect(decodeString('$?unknown')).toBe('$?unknown');
    expect(decodeString('$')).toBe('$');
  });
  it.each([4, 7])('recognizes %i-field elements and recursively decodes props', (length) => {
    const tuple = [
      '$',
      '$L5',
      'key',
      { children: '$$literal' },
      ...['$1', [], 0].slice(0, length - 4),
    ];
    const element = decodeJson(tuple);
    expect(isElement(element)).toBe(true);
    if (!isElement(element)) throw Error('Expected element');
    expect(isRef(element.type)).toBe(true);
    expect(element.props.children).toBe('$literal');
    expect(element.extra?.length ?? 0).toBe(length - 4);
    expect(decodeJson(['$', 1, 2])).toEqual(['$', 1, 2]);
    expect(decodeJson([1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
  });
});
