import { describe, expect, it } from 'vitest';
import { decodeString, isRef } from '../src/decode';
import { buildPayload, deref, mergePayloadRows, parseFlight, resolveRef } from '../src/payload';

const parse = (source: string) => parseFlight(new TextEncoder().encode(source));
describe('Flight rows and references', () => {
  it('interprets both module formats, hints, console, errors, debug, I/O, and binary rows', () => {
    const p = parse(
      '0:{"client":"$L1"}\n1:I[42,["chunk.js"],"Counter",true]\n2:I{"id":"path/module","chunks":["a.js"],"name":"Widget"}\n3:W["warn",[],"$4","Server","café — 👋",{"x":1}]\n4:E{"message":"broken","digest":"abc"}\n5:HL["a.css","style"]\n6:D{"name":"Page"}\n7:J{"name":"fetch"}\n8:N123.5\n9:R\na:O3,abcb:{bad}\n',
    );
    expect(p.modules.get(1)).toMatchObject({
      moduleId: '42',
      chunks: ['chunk.js'],
      name: 'Counter',
      async: true,
    });
    expect(p.modules.get(2)).toMatchObject({ moduleId: 'path/module', name: 'Widget' });
    expect(p.console[0]).toMatchObject({
      method: 'warn',
      env: 'Server',
      args: ['café — 👋', { x: 1 }],
    });
    expect(p.errors[0]?.value).toEqual({ message: 'broken', digest: 'abc' });
    expect(p.hints).toEqual([{ code: 'L', value: ['a.css', 'style'] }]);
    expect(p.debug).toHaveLength(1);
    expect(p.io).toHaveLength(1);
    expect(p.rows.find((row) => row.id === 8)?.value).toBe(123.5);
    expect(p.rows.find((row) => row.id === 10)?.text).toBe('<3 bytes>');
    expect(p.rows.find((row) => row.id === 11)?.parseError).toBeTruthy();
    expect(p.chunks.get(7)?.kind).toBe('io');
    expect(p.totalBytes).toBe(p.rows.reduce((n, row) => n + row.byteLength, 0));
  });
  it('resolves element paths, module references and last values; bounds cycles', () => {
    const p = parse(
      '0:["$","div",null,{"children":"$2"}]\n1:I[12,[],"Counter"]\n2:"hello"\n2:"latest"\n3:"$4"\n4:"$3"\n5:{"child":"$0:props:children"}\n',
    );
    const ref = decodeString('$0:props:children');
    if (!isRef(ref)) throw Error('Expected ref');
    expect(resolveRef(p, ref)).toMatchObject({ id: 2 });
    expect(deref(p, ref)).toBe('latest');
    expect(deref(p, decodeString('$L1'))).toMatchObject({
      kind: 'client-module',
      value: 'Counter',
    });
    expect(deref(p, decodeString('$missing'))).toBe('$missing');
    expect(deref(p, decodeString('$9'))).toBeUndefined();
    expect(isRef(deref(p, decodeString('$3')))).toBe(true);
    const pathCycle = decodeString('$3:x');
    if (!isRef(pathCycle)) throw Error('Expected ref');
    expect(resolveRef(p, pathCycle)).toBeUndefined();
  });
  it('merges separate channels without debug models/text/errors/I/O overwriting main models', () => {
    const main = parse('0:{"main":true}\n1:T4,main2:D{"time":5}\n');
    const debug = parse(
      '0:{"debug":true}\n1:T5,debug0:E{"message":"debug error"}\n1:J{"name":"io"}\n3:{"name":"Page"}\n2:D"$3"\n4:W["log",[],null,"Server","message"]\n',
    );
    const merged = buildPayload(mergePayloadRows(main.rows, debug.rows));
    expect(merged.chunks.get(0)?.value).toEqual({ main: true });
    expect(merged.chunks.get(1)?.value).toBe('main');
    expect(merged.chunks.get(3)?.value).toEqual({ name: 'Page' });
    expect(merged.console).toHaveLength(1);
    expect(merged.debug).toHaveLength(2);
    expect(merged.errors).toHaveLength(1);
    expect(merged.io).toHaveLength(1);
  });
});
