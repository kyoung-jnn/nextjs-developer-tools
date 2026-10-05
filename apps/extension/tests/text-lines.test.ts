import { describe, expect, it } from 'vitest';
import { searchText } from '../src/panel/search/matchers';
import { textLines } from '../src/panel/search/text-lines';

describe('Raw text line filtering', () => {
  it('retains matching lines with original numbers and offsets', () => {
    const raw = 'other\nZoë one\nother\nZoë two\n';
    const ranges = searchText(raw, 'Zoë');
    const lines = textLines(raw, ranges, true);
    expect(lines.map((line) => line.number)).toEqual([2, 4]);
    expect(lines.map((line) => raw.slice(line.start, line.end))).toEqual(['Zoë one', 'Zoë two']);
    expect(lines.flatMap((line) => line.ranges)).toEqual(ranges);
    expect(textLines(raw, ranges, false)).toHaveLength(5);
  });
  it('keeps adjacent matches, blank lines when off, and no matches when on', () => {
    const raw = 'hit\nhit\n\nmiss';
    expect(textLines(raw, searchText(raw, 'hit'), true).map((line) => line.number)).toEqual([1, 2]);
    expect(textLines(raw, [], true)).toEqual([]);
    expect(textLines(raw, [], false)).toHaveLength(4);
  });
  it('retains both lines for a match spanning a newline', () => {
    expect(
      textLines('left\nright', [{ start: 2, end: 7 }], true).map((line) => line.number),
    ).toEqual([1, 2]);
  });
});
