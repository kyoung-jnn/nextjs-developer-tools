import { readFileSync } from 'node:fs';
import {
  buildPayload,
  collectClientProps,
  extractSegmentsFromScript,
  parseFlight,
  segmentsToBytes,
} from '@nextjs-devtools/flight-parser';
import type { Page } from '@playwright/test';
import { searchRows, searchText, searchValue } from '../../src/panel/search/matchers';
import { SEARCH_SOURCE, type SearchAction } from '../../src/panel/search/transport';
import { expect, test } from './fixtures';

const home = readFileSync(
  new URL(
    '../../../../packages/flight-parser/tests/fixtures/next16-home-prod.txt',
    import.meta.url,
  ),
  'utf8',
);
const bytes = segmentsToBytes(extractSegmentsFromScript(home));
const payload = buildPayload(parseFlight(bytes).rows);
const query = 'error';
const propsCount = collectClientProps(payload).reduce(
  (count, client) => count + searchValue(client.props, query).count,
  0,
);

async function devtoolsSearch(page: Page, action: SearchAction) {
  await page.evaluate(({ source, payload }) => window.postMessage({ source, payload }, '*'), {
    source: SEARCH_SOURCE,
    payload: action,
  });
}

test('Search shortcut reveals collapsed Props matches and navigates the parsed match count', async ({
  extension,
}) => {
  const { page } = extension;
  const id = new URL(extension.worker.url()).host;
  await page.goto(`chrome-extension://${id}/panel-preview.html?record=app-document&tab=Props`);
  await expect(page.locator('.detail-content')).toContainText('Next.js internals');
  const hiddenKey = page.locator('.json-key').filter({ hasText: 'parallelRouterKey' }).first();
  await expect(hiddenKey).not.toBeVisible();
  // DevTools forwards shortcuts from a document bubble listener; K must stop before it.
  await page.evaluate(() => {
    document.body.dataset.forwarded = '';
    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && ['k', 'f'].includes(event.key.toLowerCase()))
        document.body.dataset.forwarded += event.key.toLowerCase();
    });
  });
  await page.keyboard.press('Control+k');
  const input = page.getByRole('textbox', { name: 'Search props' });
  await expect(input).toBeFocused();
  await expect(page.locator('body')).toHaveAttribute('data-forwarded', '');
  await input.fill('parallelRouterKey');
  await expect(page.locator('.search-count')).toHaveText('1 / 1');
  await expect(hiddenKey).toBeVisible();
  await expect(hiddenKey.locator('mark')).toHaveText('parallelRouterKey');
  await input.fill(query);
  expect(propsCount).toBeGreaterThan(1);
  await expect(page.locator('.search-count')).toHaveText(`1 / ${propsCount}`);
  await expect(page.locator('mark.current-match').first()).toBeVisible();
  const firstCurrent = await page
    .locator('mark.current-match')
    .first()
    .evaluate((mark) => mark.parentElement?.outerHTML);
  await input.press('Enter');
  await expect(page.locator('.search-count')).toHaveText(`2 / ${propsCount}`);
  await expect(page.locator('mark.current-match').first()).toBeVisible();
  expect(
    await page
      .locator('mark.current-match')
      .first()
      .evaluate((mark) => mark.parentElement?.outerHTML),
  ).not.toBe(firstCurrent);
  await input.press('Shift+Enter');
  await expect(page.locator('.search-count')).toHaveText(`1 / ${propsCount}`);
  await input.fill(query.toUpperCase());
  await expect(page.locator('.search-count')).toHaveText(`1 / ${propsCount}`);
  await page.getByRole('button', { name: 'Match case' }).click();
  await expect(page.locator('.search-count')).toHaveText('No matches');
  await page.getByRole('button', { name: 'Match case' }).click();
  await expect(page.locator('.search-count')).toHaveText(`1 / ${propsCount}`);
  await page.keyboard.press('Meta+g');
  await expect(page.locator('.search-count')).toHaveText(`2 / ${propsCount}`);
  await page.keyboard.press('Meta+Shift+g');
  await expect(page.locator('.search-count')).toHaveText(`1 / ${propsCount}`);
  await page.getByRole('button', { name: 'Next match' }).click();
  await expect(page.locator('.search-count')).toHaveText(`2 / ${propsCount}`);
  await page.getByRole('button', { name: 'Previous match' }).click();
  await expect(page.locator('.search-count')).toHaveText(`1 / ${propsCount}`);
  await input.fill('parallelRouterKey');
  await expect(page.locator('.search-count')).toHaveText('1 / 1');
  await expect(page.getByRole('checkbox', { name: 'Matching only' })).toBeChecked();
  await expect(page.locator('.detail-content')).not.toContainText(
    'Hello 👋 — café data sent from the server',
  );
  await page.getByRole('checkbox', { name: 'Matching only' }).uncheck();
  await expect(page.locator('.detail-content')).toContainText(
    'Hello 👋 — café data sent from the server',
  );
  await input.fill(query);
  // 10-search §13: Cmd/Ctrl+K toggles. Pressing it while open closes and clears the search.
  await page.keyboard.press('Meta+k');
  await expect(page.getByRole('search')).toHaveCount(0);
  await page.keyboard.press('Meta+k');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('');
  await page.keyboard.press('Control+f');
  await expect(page.locator('body')).toHaveAttribute('data-forwarded', 'f');
  await input.press('Escape');
  await expect(page.getByRole('search')).toHaveCount(0);
});

test('Raw Rows and Text reuse the query, highlight matches, and preserve search across records', async ({
  extension,
}) => {
  const { page } = extension;
  const id = new URL(extension.worker.url()).host;
  await page.goto(
    `chrome-extension://${id}/panel-preview.html?record=app-document&tab=Props&search=${query}`,
  );
  await expect(page.getByRole('textbox', { name: 'Search props' })).toHaveValue(query);
  await page.getByRole('tab', { name: 'Raw', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Search raw' });
  await expect(input).toHaveValue(query);
  await expect(page.getByRole('search')).toHaveCount(1);
  await page.getByRole('button', { name: 'Rows', exact: true }).click();
  const rowCount = searchRows(payload.rows, query).length;
  expect(rowCount).toBeGreaterThan(0);
  await expect(page.locator('.search-count')).toHaveText(`1 / ${rowCount}`);
  await expect(page.locator('.rows tbody tr')).toHaveCount(rowCount);
  await page.getByRole('checkbox', { name: 'Matching only' }).uncheck();
  await expect(page.locator('.rows tbody tr')).toHaveCount(payload.rows.length);
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  const textCount = searchText(new TextDecoder().decode(bytes), query).length;
  await expect(page.locator('.search-count')).toHaveText(`1 / ${textCount}`);
  await expect(page.locator('pre.raw mark')).toHaveCount(textCount);
  await input.press('Enter');
  await expect(page.locator('.search-count')).toHaveText(`2 / ${textCount}`);
  await page.getByRole('tab', { name: 'Props', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Search props' })).toHaveValue(query);
  await page.locator('.request[title="http://localhost:3000/legacy"]').click();
  await expect(page.getByRole('textbox', { name: 'Search props' })).toHaveValue(query);
  await expect(page.locator('.search-count')).toHaveText('No matches');
});

test('Shortcut keeps the current tab and DevTools search messages search that tab', async ({
  extension,
}) => {
  const { page } = extension;
  const id = new URL(extension.worker.url()).host;
  await page.goto(`chrome-extension://${id}/panel-preview.html?record=app-document&tab=Meta`);
  await page.keyboard.press('Control+k');
  // docs/design/10-search.md §11: search never switches tabs.
  await expect(page.getByRole('tab', { name: 'Meta', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('textbox', { name: 'Search meta' })).toBeFocused();
  await page.getByRole('button', { name: 'Close search' }).click();
  // "url" matches the canonicalUrlParts label and the URL request field.
  await devtoolsSearch(page, { action: 'performSearch', query: 'url' });
  await expect(page.getByRole('tab', { name: 'Meta', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('textbox', { name: 'Search meta' })).toHaveValue('url');
  await expect(page.locator('.search-count')).toHaveText(/^1 \/ ([2-9]|\d{2,})$/);
  const total = (await page.locator('.search-count').textContent())?.split(' / ')[1];
  await devtoolsSearch(page, { action: 'nextSearchResult' });
  await expect(page.locator('.search-count')).toHaveText(`2 / ${total}`);
  await devtoolsSearch(page, { action: 'previousSearchResult' });
  await expect(page.locator('.search-count')).toHaveText(`1 / ${total}`);
  await devtoolsSearch(page, { action: 'cancelSearch' });
  await expect(page.getByRole('search')).toHaveCount(0);
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('textbox', { name: 'Search meta' })).toHaveValue('');
  // Props still works with the same bar.
  await page.getByRole('tab', { name: 'Props', exact: true }).click();
  await devtoolsSearch(page, { action: 'performSearch', query });
  await expect(page.locator('.search-count')).toHaveText(`1 / ${propsCount}`);
});

test('DevTools search messages from another extension window reach the panel', async ({
  extension,
}) => {
  const { page: sender, context } = extension;
  const id = new URL(extension.worker.url()).host;
  const base = `chrome-extension://${id}/panel-preview.html`;
  await sender.goto(`${base}?record=app-document&tab=Meta`);
  const [panel] = await Promise.all([
    context.waitForEvent('page'),
    sender.evaluate((url) => {
      (window as Window & { searchTarget?: Window | null }).searchTarget = window.open(url);
    }, `${base}?record=app-document&tab=Meta`),
  ]);
  await expect(panel.getByRole('tab', { name: 'Meta', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await sender.evaluate(
    ({ source, payload }) => {
      const target = (window as Window & { searchTarget?: Window | null }).searchTarget;
      if (!target) throw Error('No panel window');
      target.postMessage({ source, payload }, location.origin);
    },
    { source: SEARCH_SOURCE, payload: { action: 'performSearch', query } },
  );
  // The target panel searches its current tab (Meta) instead of switching to Props.
  await expect(panel.getByRole('tab', { name: 'Meta', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(panel.getByRole('textbox', { name: 'Search meta' })).toHaveValue(query);
  // The sender remains on Meta: only the target panel receives the search action.
  await expect(sender.getByRole('tab', { name: 'Meta', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});
