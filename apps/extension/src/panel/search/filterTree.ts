import { isElement, isRef, isSpecial } from '@nextjs-devtools/flight-parser';
import { ancestorPaths, DEFAULT_SEARCH_BUDGET, pathKey } from './matchers';

export interface TreeFilter {
  visible: Set<string>;
  hiddenCounts: Map<string, number>;
  limited: boolean;
}

/** Paths are relative to value. Counts describe hidden direct children, never whole subtrees. */
export function filterTree(
  value: unknown,
  matchPaths: readonly (readonly string[])[],
  keyMatchPaths: readonly (readonly string[])[],
): TreeFilter {
  const required = ancestorPaths([...matchPaths, ...keyMatchPaths]);
  const keyMatches = new Set(keyMatchPaths.map(pathKey));
  const result: TreeFilter = {
    visible: new Set(required),
    hiddenCounts: new Map(),
    limited: false,
  };
  const active = new WeakSet<object>();
  type Frame = {
    source: Record<string, unknown>;
    identity: object;
    keys: string[];
    index: number;
    path: string[];
    all: boolean;
  };
  const stack: Frame[] = [];
  let pending: { value: unknown; path: string[]; all: boolean } | undefined = {
    value,
    path: [],
    all: false,
  };
  let visited = 0;
  while (pending || stack.length) {
    if (!pending) {
      const frame = stack[stack.length - 1];
      if (!frame) break;
      if (frame.index === frame.keys.length) {
        active.delete(frame.identity);
        stack.pop();
        continue;
      }
      const key = frame.keys[frame.index++];
      if (key === undefined) continue;
      const path = [...frame.path, key];
      if (!frame.all && !required.has(pathKey(path))) continue;
      if (visited >= DEFAULT_SEARCH_BUDGET) {
        result.limited = true;
        break;
      }
      try {
        pending = { value: frame.source[key], path, all: frame.all };
      } catch {
        visited++;
        result.limited = true;
        continue;
      }
    }
    if (visited++ >= DEFAULT_SEARCH_BUDGET) {
      result.limited = true;
      break;
    }
    const node = pending;
    pending = undefined;
    const id = pathKey(node.path);
    const all = node.all || keyMatches.has(id);
    if (all) result.visible.add(id);
    try {
      if (
        !node.value ||
        typeof node.value !== 'object' ||
        isRef(node.value) ||
        isSpecial(node.value) ||
        active.has(node.value)
      )
        continue;
      const object = isElement(node.value)
        ? {
            type: node.value.type,
            key: node.value.key,
            props: node.value.props,
            extra: node.value.extra,
          }
        : node.value;
      const keys = Object.keys(object);
      const hidden = all
        ? 0
        : keys.reduce(
            (count, key) => count + Number(!required.has(pathKey([...node.path, key]))),
            0,
          );
      if (hidden) result.hiddenCounts.set(id, hidden);
      active.add(node.value);
      stack.push({
        source: object as Record<string, unknown>,
        identity: node.value,
        keys,
        index: 0,
        path: node.path,
        all,
      });
    } catch {
      result.limited = true;
    }
  }
  return result;
}
