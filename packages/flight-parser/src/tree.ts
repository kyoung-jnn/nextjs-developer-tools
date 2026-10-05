import { type FlightValue, isElement, isRef, isSpecial } from './decode';
import { type ClientModule, deref, type FlightPayload, resolveRef } from './payload';
export interface TreeNode {
  kind: 'element' | 'client' | 'text' | 'value' | 'ref' | 'fragment' | 'suspense';
  label: string;
  props?: Record<string, FlightValue>;
  children: TreeNode[];
  refId?: number;
  moduleId?: string;
  chunks?: string[];
}
export function buildTree(
  payload: FlightPayload,
  root: FlightValue | undefined = payload.chunks.get(0)?.value,
  opts: { maxDepth?: number } = {},
): TreeNode {
  const visit = (value: FlightValue | undefined, depth: number, ids: Set<number>): TreeNode => {
    const node = (kind: TreeNode['kind'], label: string, children: TreeNode[] = []): TreeNode => ({
      kind,
      label,
      children,
    });
    if (depth >= (opts.maxDepth ?? 200)) return node('value', '(max depth)');
    if (isRef(value)) {
      if (ids.has(value.id)) return { ...node('ref', `${value.raw} (circular)`), refId: value.id };
      const target = resolveRef(payload, value);
      if (target === undefined)
        return { ...node('ref', `${value.raw} (pending)`), refId: value.id };
      return { ...visit(target, depth + 1, new Set([...ids, value.id])), refId: value.id };
    }
    if (isElement(value)) {
      const props = Object.fromEntries(
        Object.entries(value.props).filter(([key]) => key !== 'children'),
      );
      const type = value.type;
      const mod = isRef(type) ? payload.modules.get(type.id) : undefined;
      const resolvedType = deref(payload, type);
      const special = isSpecial(resolvedType) ? resolvedType : undefined;
      const kind = mod
        ? 'client'
        : special?.value === 'react.suspense'
          ? 'suspense'
          : special?.value === 'react.fragment'
            ? 'fragment'
            : 'element';
      const label = mod
        ? clientLabel(mod)
        : kind === 'suspense'
          ? 'Suspense'
          : kind === 'fragment'
            ? 'Fragment'
            : typeof type === 'string'
              ? type
              : 'Element';
      const children =
        value.props.children === undefined ? [] : [visit(value.props.children, depth + 1, ids)];
      return {
        ...node(kind, label, children),
        props,
        ...(mod ? { moduleId: mod.moduleId, chunks: mod.chunks } : {}),
      };
    }
    if (Array.isArray(value))
      return node(
        'value',
        `Array(${value.length})`,
        value.map((child) => visit(child, depth + 1, ids)),
      );
    if (value && typeof value === 'object' && !isSpecial(value))
      return node(
        'value',
        'Object',
        Object.entries(value).map(([key, child]) =>
          node('value', key, [visit(child, depth + 1, ids)]),
        ),
      );
    if (typeof value === 'string') return node('text', JSON.stringify(value));
    return node('value', isSpecial(value) ? (value.value ?? value.kind) : String(value));
  };
  return visit(root, 0, new Set());
}
export interface ClientProps {
  component: string;
  moduleId: string;
  props: Record<string, FlightValue>;
  path: string[];
}
export function collectClientProps(payload: FlightPayload): ClientProps[] {
  const result: ClientProps[] = [];
  const visit = (node: TreeNode, path: string[]) => {
    const next = [...path, node.label];
    if (node.kind === 'client' && node.moduleId !== undefined)
      result.push({
        component: node.label,
        moduleId: node.moduleId,
        props: node.props ?? {},
        path: next,
      });
    for (const child of node.children) visit(child, next);
  };
  visit(buildTree(payload), []);
  return result;
}

function clientLabel(module: ClientModule): string {
  if (module.name && module.name !== 'default' && module.name !== '*') return module.name;
  const path = module.moduleId.replace(/^\[project\]\//, '').replace(/\s*\[.*$/, '');
  if (path.includes('/')) return path.split('/').at(-1) || `Client#${module.moduleId}`;
  return `Client#${module.moduleId}`;
}
export function buildRenderTree(payload: FlightPayload): TreeNode {
  const roots: TreeNode[] = [];
  const visit = (value: FlightValue | undefined, depth: number, seen: Set<number>): void => {
    if (depth >= 200) return;
    if (isRef(value)) {
      if (seen.has(value.id)) return;
      visit(resolveRef(payload, value), depth + 1, new Set([...seen, value.id]));
      return;
    }
    if (isElement(value)) {
      roots.push(buildTree(payload, value));
      return;
    }
    if (Array.isArray(value)) {
      for (const child of value) visit(child, depth + 1, seen);
    } else if (value && typeof value === 'object' && !isSpecial(value)) {
      for (const child of Object.values(value)) visit(child, depth + 1, seen);
    }
  };
  visit(payload.chunks.get(0)?.value, 0, new Set());
  return { kind: 'value', label: 'Render tree', children: roots };
}
