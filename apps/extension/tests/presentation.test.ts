import { parseFlight, type TreeNode } from '@nextjs-devtools/flight-parser';
import { describe, expect, it } from 'vitest';
import {
  groupClients,
  isInternal,
  propsPreview,
  renderChildren,
  serverComponents,
} from '../src/panel/presentation';
import { encode } from './helpers';

const node = (kind: TreeNode['kind'], label: string, children: TreeNode[] = []): TreeNode => ({
  kind,
  label,
  children,
});
describe('Panel presentation', () => {
  it('flattens child arrays, hides empty children, optionally collapses single-child fragments', () => {
    const text = node('text', '"hello"');
    const fragment = node('fragment', 'Fragment', [node('value', 'Array(1)', [text])]);
    const children = [
      node('value', 'Array(5)', [
        node('value', 'null'),
        node('value', 'undefined'),
        node('value', 'false'),
        node('text', '""'),
        fragment,
      ]),
    ];
    expect(renderChildren(children, false)).toEqual([text]);
    expect(renderChildren(children, true)).toEqual([fragment]);
    expect(renderChildren([node('value', '0')], false)).toEqual([node('value', '0')]);
  });
  it('groups repeated module IDs and detects Next internals by name, props and dev module paths', () => {
    const counter = { component: 'Counter', moduleId: '42', props: { message: 'hello' }, path: [] };
    const internal = {
      component: 'Client#1',
      moduleId: '1',
      props: { parallelRouterKey: 'children' },
      path: [],
    };
    expect(groupClients([counter, counter, internal])).toEqual([
      expect.objectContaining({ moduleId: '42', internal: false, instances: [counter, counter] }),
      expect.objectContaining({ moduleId: '1', internal: true }),
    ]);
    expect(isInternal({ ...counter, component: 'OutletBoundary' })).toBe(true);
    expect(isInternal({ ...counter, moduleId: '[project]/node_modules/next/client.js' })).toBe(
      true,
    );
    expect(isInternal(counter)).toBe(false);
  });
  it('summarizes component names/props with relative timing through debug model references', () => {
    const payload = parseFlight(
      encode(
        '1:{"name":"Page","env":"Server","key":"k","props":{"message":"hello"}}\n2:{"time":10}\n3:{"time":25}\n4:D"$2"\n4:D"$1"\n4:D"$3"\n',
      ),
    );
    expect(serverComponents(payload)).toEqual([
      expect.objectContaining({
        id: 4,
        name: 'Page',
        env: 'Server',
        key: 'k',
        props: { message: 'hello' },
        duration: 15,
      }),
    ]);
    expect(
      propsPreview({ message: 'hello', items: [1, 2], nested: { x: 1 }, count: 3, extra: true }),
    ).toBe('{message: "hello", items: Array(2), nested: {…}, count: 3, …}');
  });
});
