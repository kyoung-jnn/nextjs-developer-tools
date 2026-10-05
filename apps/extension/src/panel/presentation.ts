import {
  type ClientProps,
  deref,
  type FlightPayload,
  type FlightValue,
  type TreeNode,
} from '@nextjs-devtools/flight-parser';

const INTERNAL_NAMES = new Set([
  'OutletBoundary',
  'ViewportBoundary',
  'MetadataBoundary',
  'RootLayoutBoundary',
  'HTTPAccessFallbackBoundary',
  'ClientPageRoot',
  'ClientSegmentRoot',
  'LayoutRouter',
  'RenderFromTemplateContext',
  'ErrorBoundary',
]);
export function isInternal(client: Pick<ClientProps, 'component' | 'moduleId' | 'props'>): boolean {
  return (
    INTERNAL_NAMES.has(client.component) ||
    /node_modules\/next\//.test(client.moduleId) ||
    ['parallelRouterKey', 'segmentPath', 'template', 'notFound'].some((key) => key in client.props)
  );
}
export function renderChildren(nodes: TreeNode[], fragments: boolean): TreeNode[] {
  const result: TreeNode[] = [];
  for (const node of nodes) {
    if (
      (node.kind === 'value' && ['null', 'undefined', 'false'].includes(node.label)) ||
      (node.kind === 'text' && node.label === '""')
    )
      continue;
    if (node.kind === 'value' && /^Array\(\d+\)$/.test(node.label)) {
      for (const child of renderChildren(node.children, fragments)) result.push(child);
      continue;
    }
    if (!fragments && node.kind === 'fragment') {
      const children = renderChildren(node.children, fragments);
      if (children.length === 1) {
        result.push(...children);
        continue;
      }
    }
    result.push(node);
  }
  return result;
}
export function groupClients(clients: ClientProps[]) {
  const groups = new Map<
    string,
    { moduleId: string; component: string; internal: boolean; instances: ClientProps[] }
  >();
  for (const client of clients) {
    const group = groups.get(client.moduleId);
    if (group) {
      group.instances.push(client);
      group.internal ||= isInternal(client);
    } else
      groups.set(client.moduleId, {
        moduleId: client.moduleId,
        component: client.component,
        internal: isInternal(client),
        instances: [client],
      });
  }
  return Array.from(groups.values());
}
function object(value: FlightValue | undefined): Record<string, FlightValue> | null {
  return value && typeof value === 'object' && !Array.isArray(value) && !('$flight' in value)
    ? value
    : null;
}
export function serverComponents(payload: FlightPayload) {
  const groups = new Map<
    number,
    { id: number; name: string; env: string; key: FlightValue; props: FlightValue; times: number[] }
  >();
  for (const row of payload.debug) {
    const value = object(deref(payload, row.value));
    if (!value) continue;
    const group = groups.get(row.id);
    if (typeof value.name === 'string') {
      groups.set(row.id, {
        id: row.id,
        name: value.name,
        env: String(value.env ?? ''),
        key: value.key ?? null,
        props: value.props ?? null,
        times: group?.times ?? [],
      });
    } else if (typeof value.time === 'number') {
      if (group) group.times.push(value.time);
      else
        groups.set(row.id, {
          id: row.id,
          name: '',
          env: '',
          key: null,
          props: null,
          times: [value.time],
        });
    }
  }
  return Array.from(groups.values())
    .filter((group) => group.name)
    .map((group) => ({
      ...group,
      duration: group.times.length > 1 ? Math.max(...group.times) - Math.min(...group.times) : null,
    }));
}

export function propsPreview(value: FlightValue): string {
  const props = object(value);
  if (!props) return typeof value === 'string' ? value.slice(0, 120) : String(value);
  const keys = Object.keys(props);
  const preview = keys
    .slice(0, 4)
    .map((key) => {
      const item = props[key];
      const text =
        typeof item === 'string'
          ? JSON.stringify(item.slice(0, 60))
          : item === null || typeof item !== 'object'
            ? String(item)
            : Array.isArray(item)
              ? `Array(${item.length})`
              : '{…}';
      return `${key}: ${text}`;
    })
    .join(', ');
  return `{${preview}${keys.length > 4 ? ', …' : ''}}`;
}
