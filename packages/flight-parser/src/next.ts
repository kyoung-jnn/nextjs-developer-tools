import { type FlightValue, isElement, isRef, isSpecial } from './decode';
import { deref, type FlightPayload, resolveRef } from './payload';
export interface RouteNode {
  segment: string;
  parallelKey?: string;
  children: RouteNode[];
}
export interface NextSummary {
  format: 'object' | 'array' | 'unknown';
  buildId?: string;
  canonicalUrl?: string;
  fields: { key: string; label: string; value: FlightValue }[];
  routeTree?: RouteNode;
}
const labels: Record<string, string> = {
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
function object(value: FlightValue | undefined): value is Record<string, FlightValue> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !isRef(value) &&
    !isElement(value) &&
    !isSpecial(value)
  );
}
export function summarizeNext(payload: FlightPayload): NextSummary {
  const root = deref(payload, payload.chunks.get(0)?.value);
  const result: NextSummary = {
    format: Array.isArray(root) ? 'array' : object(root) ? 'object' : 'unknown',
    fields: [],
  };
  if (Array.isArray(root) && typeof root[0] === 'string') result.buildId = root[0];
  if (object(root)) {
    result.fields = Object.entries(root).map(([key, value]) => ({
      key,
      label: labels[key] ?? key,
      value,
    }));
    if (typeof root.b === 'string') result.buildId = root.b;
    if (Array.isArray(root.c) && root.c.every((part) => typeof part === 'string'))
      result.canonicalUrl = root.c.join('/');
  }
  const route = (
    value: FlightValue | undefined,
    depth: number,
    seen: Set<number>,
  ): RouteNode | undefined => {
    if (depth > 40) return undefined;
    if (isRef(value)) {
      if (seen.has(value.id)) return undefined;
      return route(resolveRef(payload, value), depth + 1, new Set([...seen, value.id]));
    }
    if (!Array.isArray(value)) return undefined;
    const segment = value[0];
    const parallels = deref(payload, value[1]);
    const name =
      typeof segment === 'string'
        ? segment
        : Array.isArray(segment) &&
            segment.length >= 3 &&
            typeof segment[0] === 'string' &&
            typeof segment[1] === 'string'
          ? `[${segment[0]}]=${segment[1]}`
          : undefined;
    if (name === undefined || !object(parallels)) return undefined;
    const children: RouteNode[] = [];
    for (const [key, child] of Object.entries(parallels)) {
      const parsed = route(child, depth + 1, seen);
      if (!parsed) return undefined;
      children.push({ ...parsed, parallelKey: key });
    }
    return { segment: name, children };
  };
  const search = (
    value: FlightValue | undefined,
    depth: number,
    seen: Set<number>,
  ): RouteNode | undefined => {
    if (depth > 40) return undefined;
    if (isRef(value)) {
      if (seen.has(value.id)) return undefined;
      return search(resolveRef(payload, value), depth + 1, new Set([...seen, value.id]));
    }
    const found = route(value, depth, seen);
    if (found) return found;
    const children = Array.isArray(value)
      ? value
      : object(value)
        ? Object.values(value)
        : isElement(value)
          ? [value.props]
          : [];
    for (const child of children) {
      const foundChild = search(child, depth + 1, seen);
      if (foundChild) return foundChild;
    }
    return undefined;
  };
  const tree = search(root, 0, new Set());
  if (tree) result.routeTree = tree;
  return result;
}
