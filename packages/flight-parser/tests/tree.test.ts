import { describe, expect, it } from 'vitest';
import { decodeJson } from '../src/decode';
import { parseFlight } from '../src/payload';
import { buildRenderTree, buildTree, collectClientProps, type TreeNode } from '../src/tree';

const parse = (text: string) => parseFlight(new TextEncoder().encode(text));
const flatten = (node: TreeNode): TreeNode[] => [node, ...node.children.flatMap(flatten)];
describe('Flight display trees', () => {
  it('expands lazy/promise refs, client modules, suspense and fragments; excludes children from props', () => {
    const payload = parse(
      '0:{"wrapper":"$L2"}\n1:I[42,["counter.js"],"Counter"]\n2:["$","div",null,{"className":"host","children":["$","$Sreact.suspense",null,{"children":"$@3"}]}]\n3:["$","$L1",null,{"message":"café — 👋","children":["$","$Sreact.fragment",null,{"children":"text"}]}]\n',
    );
    const nodes = flatten(buildTree(payload));
    expect(nodes.map((n) => n.kind)).toContain('suspense');
    expect(nodes.map((n) => n.kind)).toContain('fragment');
    expect(nodes.find((n) => n.kind === 'client')).toMatchObject({
      label: 'Counter',
      moduleId: '42',
      chunks: ['counter.js'],
      props: { message: 'café — 👋' },
    });
    expect(collectClientProps(payload)).toEqual([
      expect.objectContaining({
        component: 'Counter',
        moduleId: '42',
        props: { message: 'café — 👋' },
        path: expect.arrayContaining(['Counter']),
      }),
    ]);
    expect(buildRenderTree(payload).children).toHaveLength(1);
    expect(buildRenderTree(payload).children[0]?.label).toBe('div');
  });
  it('keeps arrays as values, names unnamed production/dev clients, and bounds cycles and pending refs', () => {
    const payload = parse(
      '0:["$","$L1",null,{"children":["$2","$9"]}]\n1:I[86616,[],""]\n2:["$","div",null,{"children":"$2"}]\n3:I["[project]/app/counter.tsx [app-client] (ecmascript)",[],"default"]\n',
    );
    const nodes = flatten(buildTree(payload));
    expect(nodes[0]?.label).toBe('Client#86616');
    expect(nodes.find((n) => n.label === 'Array(2)')?.kind).toBe('value');
    expect(nodes.find((n) => n.label.includes('circular'))?.kind).toBe('ref');
    expect(nodes.find((n) => n.label.includes('pending'))?.refId).toBe(9);
    expect(buildTree(payload, decodeJson(['$', '$L3', null, {}])).label).toBe('counter.tsx');
    expect(
      flatten(buildTree(payload, undefined, { maxDepth: 2 })).some(
        (n) => n.label === '(max depth)',
      ),
    ).toBe(true);
  });
  it('finds only outermost render roots through references', () => {
    const payload = parse(
      '0:{"P":0,"f":["$1",["$","link",null,{}]]}\n1:["$","html",null,{"children":["$","body",null,{}]}]\n',
    );
    expect(buildRenderTree(payload).children.map((n) => n.label)).toEqual(['html', 'link']);
  });
});
