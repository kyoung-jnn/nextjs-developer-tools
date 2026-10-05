import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/** docs/design/10-search.md §11: search works in every tab, in place. */
async function open(page: Page, id: string, record: string, tab: string) {
  await page.goto(`chrome-extension://${id}/panel-preview.html?record=${record}&tab=${tab}`);
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('tab', { name: new RegExp(`^${tab}`) })).toHaveAttribute(
    'aria-selected',
    'true',
  );
}
const content = (page: Page) => page.locator('.detail-content');
const matchingOnly = (page: Page) => page.getByRole('checkbox', { name: 'Matching only' });

test('Tree search reveals a match inside node props and Matching only prunes siblings', async ({
  extension,
}) => {
  const { page } = extension;
  await open(page, new URL(extension.worker.url()).host, 'app-document', 'Tree');
  const input = page.getByRole('textbox', { name: 'Search tree' });
  await expect(input).toBeFocused();
  await input.fill('café');
  await expect(page.locator('.search-count')).toHaveText('1 / 1');
  await expect(page.locator('[data-search-current="true"]')).toContainText('café');
  await expect(matchingOnly(page)).toBeChecked();
  // Matching only: unrelated host elements such as <header> are hidden.
  await expect(content(page)).not.toContainText('<header>');
  await expect(
    content(page)
      .getByRole('button', { name: /hidden$/ })
      .first(),
  ).toBeVisible();
  await matchingOnly(page).uncheck();
  await expect(content(page)).toContainText('<header>');
  await expect(page.locator('[data-search-current="true"]')).toContainText('café');
});

test('Logs search finds the server console.warn and hides the other entry', async ({
  extension,
}) => {
  const { page } = extension;
  await open(page, new URL(extension.worker.url()).host, 'server-logs', 'Logs');
  await page.getByRole('textbox', { name: 'Search logs' }).fill('warning');
  await expect(page.locator('.search-count')).toHaveText('1 / 1');
  await expect(page.locator('[data-search-current="true"]')).toContainText('sample server warning');
  await expect(content(page)).not.toContainText('delayed component ready');
  await matchingOnly(page).uncheck();
  await expect(content(page)).toContainText('delayed component ready');
});

test('Meta search finds a response header and filters the other header rows', async ({
  extension,
}) => {
  const { page } = extension;
  await open(page, new URL(extension.worker.url()).host, 'navigation', 'Meta');
  await page.getByRole('textbox', { name: 'Search meta' }).fill('content-type');
  await expect(page.locator('.search-count')).toHaveText('1 / 1');
  await expect(page.locator('[data-search-current="true"]')).toHaveText('content-type');
  const rscRequestHeader = content(page).locator('th', { hasText: /^rsc$/ });
  await expect(rscRequestHeader).toHaveCount(0);
  await matchingOnly(page).uncheck();
  await expect(rscRequestHeader).toHaveCount(1);
});

test('Switching tabs keeps the query and recomputes matches per tab', async ({ extension }) => {
  const { page } = extension;
  await open(page, new URL(extension.worker.url()).host, 'server-logs', 'Logs');
  await page.getByRole('textbox', { name: 'Search logs' }).fill('Delayed');
  await expect(page.locator('.search-count')).toHaveText(/^1 \/ \d+$/);
  const logs = await page.locator('.search-count').textContent();
  await page.getByRole('tab', { name: 'Raw', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Search raw' })).toHaveValue('Delayed');
  await expect(page.locator('.search-count')).not.toHaveText(logs ?? '');
  await page.getByRole('tab', { name: 'Meta', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Search meta' })).toHaveValue('Delayed');
  await expect(page.locator('.search-count')).toHaveText('No matches');
});
