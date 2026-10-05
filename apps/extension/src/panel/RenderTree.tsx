import type { TreeNode } from '@nextjs-devtools/flight-parser';
import { useEffect, useState } from 'react';
import { JsonTree } from './JsonTree';
import { isInternal } from './presentation';
import { pathKey } from './search/matchers';
import { TREE_LIMITS, treeChildren, treeLabel } from './search/tabs';
import { revealedBySearch, SearchText, useSearchScope } from './search/useSearch';
export function RenderTree({
  node,
  onRef,
  depth = 0,
  fragments = false,
  stopped = false,
  renderMode = true,
  path,
}: {
  node: TreeNode;
  onRef: (id: number) => void;
  depth?: number;
  fragments?: boolean;
  stopped?: boolean;
  renderMode?: boolean;
  /** Search path of this node (`['tree', ...childIndices]`), see search/tabs.ts. */
  path?: string[];
}) {
  const [open, setOpen] = useState(renderMode ? depth < 8 && !stopped : depth < 3);
  const [props, setProps] = useState(false);
  const [limit, setLimit] = useState(100);
  const search = useSearchScope();
  const [reveal, setReveal] = useState<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: A new query resets the "… N hidden" override.
  useEffect(() => {
    setReveal(null);
  }, [search?.query]);
  const children = treeChildren(node, renderMode, fragments);
  const childPath = (index: number) => (path ? [...path, String(index)] : undefined);
  const searching = Boolean(path && search?.query);
  // Expand when a match sits in a descendant; a label-only match keeps the subtree as it was.
  const childHasMatch = (index: number) => {
    const p = childPath(index);
    return Boolean(searching && p && search?.ancestors.has(pathKey(p)));
  };
  const forcedOpen = searching && children.some((_, index) => childHasMatch(index));
  const expanded = open || forcedOpen;
  const propsPath = path ? [...path, 'props'] : undefined;
  const showProps = props || (propsPath !== undefined && revealedBySearch(search, propsPath));
  const filtering = searching && Boolean(search?.matchingOnly) && reveal !== search?.query;
  const indexed = children.map((child, index) => ({ child, index }));
  const visible = filtering ? indexed.filter(({ index }) => childHasMatch(index)) : indexed;
  const hidden = indexed.length - visible.length;
  const boundary =
    ['body', 'main'].includes(node.label) ||
    (node.kind === 'client' &&
      !isInternal({
        component: node.label,
        moduleId: node.moduleId ?? '',
        props: node.props ?? {},
      }));
  const label = treeLabel(node);
  return (
    <div className={`render-node ${node.kind}`}>
      <div className="tree-line">
        <button
          type="button"
          className="disclosure"
          onClick={() => setOpen(!expanded)}
          aria-label={`Expand ${node.label}`}
        >
          {children.length ? (expanded ? '▾' : '▸') : '·'}
        </button>
        <button
          type="button"
          className="tree-label"
          onClick={() => setProps(!showProps)}
          title={
            node.moduleId
              ? `${node.moduleId}\nChunks: ${(node.chunks ?? []).join(', ')}`
              : undefined
          }
        >
          {path ? <SearchText text={label} path={[...path, 'label']} /> : label}
        </button>
        {node.kind === 'client' && <span className="client-badge">client</span>}
        {node.refId !== undefined && (
          <button type="button" className="ref" onClick={() => onRef(node.refId ?? 0)}>
            #{node.refId.toString(16)}
          </button>
        )}
      </div>
      {showProps && node.props && (
        <div className="node-props">
          <JsonTree value={node.props} onRef={onRef} path={propsPath} />
        </div>
      )}
      {expanded && depth < TREE_LIMITS.depth && (
        <div className="nested">
          {visible
            .filter(({ index }) => index < limit || childHasMatch(index))
            .map(({ child, index }) => (
              <RenderTree
                // Tree paths distinguish identical siblings by immutable position.
                key={`${index}:${child.label}`}
                node={child}
                onRef={onRef}
                depth={depth + 1}
                fragments={fragments}
                renderMode={renderMode}
                stopped={stopped || boundary}
                path={childPath(index)}
              />
            ))}
          {filtering && hidden > 0 && (
            <button
              className="muted"
              type="button"
              onClick={() => setReveal(search?.query ?? null)}
            >
              … {hidden} hidden
            </button>
          )}
          {!filtering && children.length > limit && (
            <button type="button" onClick={() => setLimit(limit + 100)}>
              Show 100 more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
