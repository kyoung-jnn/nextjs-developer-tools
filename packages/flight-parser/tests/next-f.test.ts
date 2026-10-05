import { describe, expect, it } from 'vitest';
import { extractSegmentsFromScript, segmentsToBytes, segmentToBytes } from '../src/next-f';

describe('__next_f segments', () => {
  it('combines UTF-8 and base64 in order, ignoring bootstrap/form state and malformed data', () => {
    const b64 = btoa(String.fromCharCode(240, 159, 145, 139));
    expect(
      new TextDecoder().decode(
        segmentsToBytes([[0], [1, 'café — '], [2, { a: 1 }], [3, b64], [1, '!']]),
      ),
    ).toBe('café — 👋!');
    for (const input of [null, [1, 7], [3, '!!!'], [2, {}]])
      expect(segmentToBytes(input)).toBeNull();
  });
  it('extracts escaped quotes/brackets/nested JSON and resumes after invalid candidates', () => {
    const segments = [
      [1, '0:{"text":"] ) \\" \\ path"}\n'],
      [2, { state: [']', { x: '"' }] }],
      [3, 'YWJj'],
    ];
    const source = `self.__next_f.push([broken]);${segments.map((seg) => `self.__next_f.push(${JSON.stringify(seg)});`).join('')}self.__next_f.push([1,"unfinished"`;
    expect(extractSegmentsFromScript(source)).toEqual(segments);
    expect(extractSegmentsFromScript('self.__next_f.push([0]);')).toEqual([[0]]);
    expect(extractSegmentsFromScript('other.push([1,"wrong"])')).toEqual([]);
  });
});
