import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JsonTree } from '../src/panel/JsonTree';
import { ancestorPaths, pathKey, searchValue } from '../src/panel/search/matchers';
import { SearchScope } from '../src/panel/search/useSearch';

function render(value: unknown, query: string, current = 0) {
  const { paths } = searchValue(value, query);
  return renderToStaticMarkup(
    createElement(
      SearchScope.Provider,
      {
        value: {
          query,
          paths: new Set(paths.map(pathKey)),
          ancestors: ancestorPaths(paths),
          current: pathKey(paths[current] ?? []),
          visibleAncestors: ancestorPaths(
            paths.length > 1000
              ? paths.slice(Math.floor(current / 250) * 250, Math.floor(current / 250) * 250 + 250)
              : paths,
          ),
          matchingOnly: true,
          caseSensitive: false,
        },
      },
      createElement(JsonTree, { value, path: [], expandDepth: 0 }),
    ),
  );
}
describe('Search expansion', () => {
  it('opens all ancestors and reveals a match beyond the first 100 children', () => {
    const value = {
      deeply: {
        nested: Array.from({ length: 150 }, (_, index) =>
          index === 149 ? 'hidden needle' : 'ordinary',
        ),
      },
    };
    const html = render(value, 'needle');
    expect(html).toContain('hidden <mark');
    expect(html).toContain('class="current-match">needle</mark>');
    expect(html).toContain('&quot;149&quot;');
  });
  it('renders a bounded window of broad matches and reveals the navigated result', () => {
    const html = render(
      Array.from({ length: 20000 }, () => 'needle'),
      'needle',
      10001,
    );
    expect((html.match(/class="json-line"/g) ?? []).length).toBeLessThanOrEqual(350);
    expect(html).toContain('&quot;10001&quot;');
    expect(html).toContain('data-search-current="true"');
    expect(html).toContain('class="current-match">needle</mark>');
  });
  it('keeps a late match visible without rendering a multi-megabyte string', () => {
    const html = render({ body: `${'x'.repeat(5 * 1024 * 1024)}needle` }, 'needle');
    expect(html).toContain('class="current-match">needle</mark>');
    expect(html.length).toBeLessThan(2000);
  });
});
