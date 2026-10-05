import type { TreeNode } from '@nextjs-devtools/flight-parser';
import { describe, expect, it } from 'vitest';
import { parseRecord } from '../src/panel/parse';
import { searchLogs, searchMeta, searchTree } from '../src/panel/search/tabs';
import type { PanelRecord } from '../src/panel/store';
import { captureRecord, encode } from './helpers';

const flight = [
  '0:{"b":"build-123","c":["","blog"],"f":[]}',
  '1:D{"name":"Delayed","env":"Server","key":null,"stack":[],"props":{"slug":"café"}}',
  '1:D{"time":12.5}',
  '2:W["warn",[],null,"Server","Streaming demo: sample server warning"]',
  '3:W["log",[],null,"Server","Delayed component ready"]',
  '',
].join('\n');
const record = {
  ...captureRecord('nav', {
    kind: 'navigation',
    url: 'https://demo.test/blog?_rsc=1',
    status: 200,
    requestHeaders: { rsc: '1' },
    responseHeaders: { 'content-type': 'text/x-component', 'x-nextjs-stale-time': '30' },
    chunks: [encode(flight)],
  }),
  // The panel store adds UI fields; the search functions only read capture fields.
} as unknown as PanelRecord;
const parsed = parseRecord(record);
const format = (ms: number) => String(ms);

describe('Meta tab search', () => {
  it('finds header names and values, request fields and Next.js fields', () => {
    const paths = searchMeta(parsed, record, 'content-type', { formatStart: format }).paths;
    expect(paths).toContainEqual(['meta', 'responseHeaders', 'content-type', 'name']);
    expect(searchMeta(parsed, record, 'x-component', { formatStart: format }).paths).toContainEqual(
      ['meta', 'responseHeaders', 'content-type', 'value'],
    );
    expect(searchMeta(parsed, record, 'build-123', { formatStart: format }).paths).toContainEqual([
      'meta',
      'buildId',
    ]);
    expect(searchMeta(parsed, record, 'stale', { formatStart: format }).paths).toContainEqual([
      'meta',
      'nextHeaders',
      'x-nextjs-stale-time',
    ]);
    expect(searchMeta(parsed, record, 'Method', { formatStart: format }).paths).toContainEqual([
      'meta',
      'request',
      'Method',
      'label',
    ]);
  });
  it('honors case sensitivity and returns nothing for an empty query', () => {
    expect(
      searchMeta(parsed, record, 'CONTENT-TYPE', { formatStart: format, caseSensitive: true })
        .paths,
    ).toEqual([]);
    expect(searchMeta(parsed, record, '', { formatStart: format }).paths).toEqual([]);
  });
});

describe('Logs tab search', () => {
  it('finds console arguments, methods and server component fields', () => {
    if (parsed.type !== 'flight') throw Error('expected a flight record');
    const warning = searchLogs(parsed.payload, 'warning', {}).paths;
    expect(warning).toEqual([['logs', 'console', '0', 'args', '0']]);
    expect(searchLogs(parsed.payload, 'warn', {}).paths).toContainEqual([
      'logs',
      'console',
      '0',
      'method',
    ]);
    const delayed = searchLogs(parsed.payload, 'Delayed', {}).paths;
    expect(delayed).toContainEqual(['logs', 'console', '1', 'args', '0']);
    expect(delayed).toContainEqual(['logs', 'components', '1', 'name']);
    expect(searchLogs(parsed.payload, 'café', {}).paths).toContainEqual([
      'logs',
      'components',
      '1',
      'props',
      'slug',
    ]);
  });
});

describe('Tree tab search', () => {
  const node = (label: string, extra: Partial<TreeNode> = {}): TreeNode => ({
    kind: 'element',
    label,
    children: [],
    ...extra,
  });
  const tree: TreeNode = node('html', {
    children: [
      // Rendered mode drops empty values and flattens arrays, so indices follow what is drawn.
      { kind: 'value', label: 'null', children: [] },
      {
        kind: 'value',
        label: 'Array(2)',
        children: [node('main'), node('section', { props: { title: 'Server café' } })],
      },
    ],
  });
  it('matches labels and props using rendered child indices', () => {
    expect(searchTree(tree, 'main', { renderMode: true, fragments: false }).paths).toContainEqual([
      'tree',
      '0',
      'label',
    ]);
    expect(searchTree(tree, 'café', { renderMode: true, fragments: false }).paths).toEqual([
      ['tree', '1', 'props', 'title'],
    ]);
  });
  it('uses raw child indices in full-payload mode', () => {
    expect(searchTree(tree, 'café', { renderMode: false, fragments: false }).paths).toEqual([
      ['tree', '1', '1', 'props', 'title'],
    ]);
  });
  it('stops at the render depth limit', () => {
    let deep = node('leaf-target');
    for (let depth = 0; depth < 40; depth++) deep = node(`n${depth}`, { children: [deep] });
    expect(searchTree(deep, 'leaf-target', { renderMode: true, fragments: false }).paths).toEqual(
      [],
    );
  });
});
