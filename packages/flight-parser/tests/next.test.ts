import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { summarizeNext } from '../src/next';
import { extractSegmentsFromScript, segmentsToBytes } from '../src/next-f';
import { buildPayload, mergePayloadRows, parseFlight } from '../src/payload';
import { buildRenderTree, collectClientProps } from '../src/tree';

const parse = (value: unknown) =>
  parseFlight(new TextEncoder().encode(`0:${JSON.stringify(value)}\n`));
const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const route = [
  '',
  {
    children: ['blog', { children: [['slug', 'hello', 'd', []], { children: ['__PAGE__', {}] }] }],
  },
];
describe('Next router metadata', () => {
  it('supports Next 14 array, Next 15 f and Next 16 t shapes', () => {
    const array = summarizeNext(parse(['build14', route]));
    expect(array).toMatchObject({ format: 'array', buildId: 'build14' });
    expect(array.routeTree?.children[0]?.segment).toBe('blog');
    for (const key of ['f', 't']) {
      const summary = summarizeNext(
        parse({
          b: `build-${key}`,
          c: ['', 'blog', 'hello'],
          [key]: [route],
          q: '',
          a: 42,
          P: 'opaque',
        }),
      );
      expect(summary).toMatchObject({
        format: 'object',
        buildId: `build-${key}`,
        canonicalUrl: '/blog/hello',
      });
      expect(summary.fields.find((field) => field.key === key)?.label).toBe(
        key === 'f' ? 'flightData' : 'transportData',
      );
      expect(summary.fields.find((field) => field.key === 'a')?.label).toBe('actionResult');
      expect(summary.fields.find((field) => field.key === 'P')?.label).toBe('P');
      expect(summary.routeTree?.children[0]?.children[0]?.segment).toBe('[slug]=hello');
    }
  });
  it('labels every documented root key and tolerates unknown/cyclic roots', () => {
    const names = {
      b: 'buildId',
      p: 'assetPrefix',
      c: 'canonicalUrlParts',
      q: 'renderedSearch',
      i: 'couldBeIntercepted',
      f: 'flightData',
      t: 'transportData',
      m: 'missingSlots',
      G: 'globalError',
      s: 'postponed/staleTime',
      S: 'prerendered/supportsPerSegmentPrefetching',
      r: 'rootVaryParams',
      n: 'MPA URL',
      a: 'actionResult',
    };
    expect(
      Object.fromEntries(
        summarizeNext(
          parse(Object.fromEntries(Object.keys(names).map((key) => [key, null]))),
        ).fields.map((field) => [field.key, field.label]),
      ),
    ).toEqual(names);
    expect(summarizeNext(parse(5)).format).toBe('unknown');
    expect(summarizeNext(parse('$0')).routeTree).toBeUndefined();
  });
  it('parses real production document/navigation/action and merged dev log fixtures', () => {
    const home = parseFlight(
      segmentsToBytes(extractSegmentsFromScript(fixture('next16-home-prod.txt'))),
    );
    expect(summarizeNext(home).buildId).toBeTruthy();
    expect(buildRenderTree(home).children.length).toBeGreaterThan(0);
    const client = collectClientProps(home).find(
      (component) => component.props.message === 'Hello 👋 — café data sent from the server',
    );
    expect(client?.moduleId).toBeTruthy();
    expect(client?.props.createdAt).toMatchObject({
      kind: 'date',
      value: '2026-10-05T00:00:00.000Z',
    });
    const navigation = parseFlight(new TextEncoder().encode(fixture('next16-navigation-prod.txt')));
    const tree = summarizeNext(navigation).routeTree;
    expect(tree?.segment).toBe('');
    expect(tree?.children[0]?.segment).toBe('blog');
    expect(tree?.children[0]?.children[0]?.segment).toBe('[slug]=hello');
    expect(tree?.children[0]?.children[0]?.children[0]?.segment).toBe('__PAGE__');
    const action = parseFlight(new TextEncoder().encode(fixture('next16-action-prod.txt')));
    expect(summarizeNext(action).fields.some((field) => field.key === 'a')).toBe(true);
    const dev = parseFlight(
      segmentsToBytes(extractSegmentsFromScript(fixture('next16-streaming-dev.txt'))),
    );
    const debug = parseFlight(new TextEncoder().encode(fixture('next16-streaming-dev-debug.txt')));
    const merged = buildPayload(mergePayloadRows(dev.rows, debug.rows));
    expect(merged.console.map((entry) => entry.args)).toContainEqual([
      'Streaming demo: delayed component ready',
    ]);
    expect(merged.console.find((entry) => entry.method === 'warn')?.args).toEqual([
      'Streaming demo: sample server warning',
    ]);
  });
});
