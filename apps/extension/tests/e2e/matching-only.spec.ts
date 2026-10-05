import { readFileSync } from 'node:fs';
import { extractSegmentsFromScript, segmentsToBytes } from '@nextjs-devtools/flight-parser';
import { parseRecord } from '../../src/panel/parse';
import { searchText } from '../../src/panel/search/matchers';
import { searchProps } from '../../src/panel/search/props';
import { expect, test } from './fixtures';

const fixture = readFileSync(
  new URL(
    '../../../../packages/flight-parser/tests/fixtures/next16-query-prod.txt',
    import.meta.url,
  ),
  'utf8',
);
const bytes = segmentsToBytes(extractSegmentsFromScript(fixture));
const raw = new TextDecoder().decode(bytes);
const parsed = parseRecord({
  id: 'query',
  kind: 'document',
  url: 'http://localhost:3000/query',
  method: 'GET',
  requestHeaders: {},
  responseHeaders: {},
  startTime: 0,
  chunks: [bytes],
  done: true,
  debugChunks: [],
  debugDone: false,
});
const query = 'Zoë';
const propsCount = searchProps(parsed, query, false, false).paths.length;

test('Matching only filters sibling fields and per-container reveals reset with the query', async ({
  extension,
}) => {
  const { page } = extension;
  const id = new URL(extension.worker.url()).host;
  await page.goto(
    `chrome-extension://${id}/panel-preview.html?record=query&tab=Props&search=${encodeURIComponent(query)}`,
  );
  const input = page.getByRole('textbox', { name: 'Search props' });
  const matching = page.getByRole('checkbox', { name: 'Matching only' });
  const cards = page.locator('.server-data-card');
  await expect(cards).toHaveCount(2);
  await expect(matching).toBeChecked();
  await expect(page.locator('.search-count')).toHaveText(`1 / ${propsCount}`);
  expect(propsCount).toBeGreaterThan(1);
  for (const card of await cards.all()) {
    await expect(card).toContainText(query);
    await expect(card).not.toContainText('"tags"');
    await expect(card).not.toContainText('Renée');
  }
  await input.press('Enter');
  await expect(page.locator('.search-count')).toHaveText(`2 / ${propsCount}`);
  await expect(page.locator('mark.current-match').first()).toBeVisible();
  await matching.uncheck();
  await expect(page.locator('.search-count')).toHaveText(`2 / ${propsCount}`);
  for (const card of await cards.all()) {
    await expect(card).toContainText('"tags"');
    await expect(card).toContainText('Renée');
  }
  await matching.check();
  await expect(page.locator('.search-count')).toHaveText(`2 / ${propsCount}`);
  const firstCard = cards.first();
  await firstCard
    .getByRole('button', { name: /^… \d+ hidden$/ })
    .first()
    .click();
  await expect(firstCard).toContainText('"tags"');
  await expect(cards.nth(1)).not.toContainText('"tags"');
  await expect(firstCard).not.toContainText('Renée');
  await expect(page.locator('.search-count')).toHaveText(`2 / ${propsCount}`);
  await input.fill('Renée');
  await expect(firstCard).toContainText('Renée');
  await input.fill(query);
  await expect(page.locator('.search-count')).toHaveText(`1 / ${propsCount}`);
  await expect(firstCard).not.toContainText('"tags"');
  await expect(firstCard).not.toContainText('Renée');
  // A matching field key includes its complete value, even where descendants do not match.
  await input.fill('posts');
  await expect(firstCard).toContainText('"tags"');
  await expect(firstCard).toContainText('Renée');
});

test('Raw Text matching-only keeps matching lines and their original line numbers', async ({
  extension,
}) => {
  const { page } = extension;
  const id = new URL(extension.worker.url()).host;
  await page.goto(
    `chrome-extension://${id}/panel-preview.html?record=query&tab=Raw&search=${encodeURIComponent(query)}`,
  );
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  const expectedLines = raw
    .split('\n')
    .flatMap((text, index) => (text.includes(query) ? [index + 1] : []));
  const count = searchText(raw, query).length;
  const lines = page.locator('pre.raw .raw-line');
  await expect(page.locator('.search-count')).toHaveText(`1 / ${count}`);
  await expect(lines).toHaveCount(expectedLines.length);
  for (const line of await lines.all()) await expect(line).toContainText(query);
  expect(
    await lines.evaluateAll((elements) =>
      elements.map((element) => Number(element.getAttribute('data-line-number'))),
    ),
  ).toEqual(expectedLines);
  const gaps = expectedLines
    .slice(1)
    .filter((line, index) => line > (expectedLines[index] ?? 0) + 1).length;
  await expect(page.locator('pre.raw .raw-separator')).toHaveCount(gaps);
  await page.getByRole('textbox', { name: 'Search raw' }).press('Enter');
  await expect(page.locator('.search-count')).toHaveText(`2 / ${count}`);
  await expect(page.locator('pre.raw mark.current-match')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Matching only' }).uncheck();
  await expect(page.locator('.search-count')).toHaveText(`2 / ${count}`);
  await expect.poll(() => lines.count()).toBeGreaterThan(expectedLines.length);
  await expect(page.locator('pre.raw')).toContainText('Renée');
  await page.getByRole('checkbox', { name: 'Matching only' }).check();
  await expect(lines).toHaveCount(expectedLines.length);
  await expect(page.locator('.search-count')).toHaveText(`2 / ${count}`);
  await expect(page.locator('pre.raw mark.current-match')).toBeVisible();
});
