import { describe, expect, it } from 'vitest';
import { FlightTokenizer, tokenize } from '../src/tokenizer';

const encode = (value: string) => new TextEncoder().encode(value);
describe('Flight tokenizer', () => {
  it('handles tagged/model rows, hex IDs, HL hints, and byte-by-byte accented/emoji text', () => {
    const text = 'café — 👋🙂\ntext';
    const stream = encode(
      `a:{"ok":true}\n1f:HL["/style.css","style"]\n2:T${encode(text).length.toString(16)},${text}3:I[42,[],"Counter"]\n`,
    );
    const expected = tokenize(stream);
    const tokenizer = new FlightTokenizer();
    const rows = Array.from(stream).flatMap((byte) => tokenizer.push(Uint8Array.of(byte)));
    rows.push(...tokenizer.flush());
    expect(rows).toEqual(expected);
    expect(rows.map((row) => [row.id, row.tag])).toEqual([
      [10, ''],
      [31, 'H'],
      [2, 'T'],
      [3, 'I'],
    ]);
    expect(new TextDecoder().decode(rows[2]?.bytes)).toBe(text);
    expect(new TextDecoder().decode(rows[1]?.bytes)).toBe('L["/style.css","style"]');
  });
  it('flushes an unterminated final model and a truncated length row once', () => {
    const tokenizer = new FlightTokenizer();
    expect(tokenizer.push(encode('0:{"last":true}'))).toEqual([]);
    expect(new TextDecoder().decode(tokenizer.flush()[0]?.bytes)).toBe('{"last":true}');
    expect(tokenizer.flush()).toEqual([]);
    expect(new TextDecoder().decode(tokenize(encode('1:T5,abc'))[0]?.bytes)).toBe('abc');
  });
  it('supports zero-length text, uppercase hex, id-less hints and binary rows', () => {
    const rows = tokenize(encode(':HL["a"]\nAF:T0,2:o3,abc3:X\n'));
    expect(rows.map((row) => [row.id, row.tag, row.bytes.length])).toEqual([
      [0, 'H', 6],
      [175, 'T', 0],
      [2, 'o', 3],
      [3, 'X', 0],
    ]);
  });
});
