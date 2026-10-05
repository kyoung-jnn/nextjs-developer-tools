import { expect, test } from './fixtures';

/** docs/design/10-search.md §13: the title-row button and Cmd/Ctrl+K both toggle search. */
test('Search button and Cmd/Ctrl+K toggle the search row', async ({ extension }) => {
  const { page } = extension;
  const id = new URL(extension.worker.url()).host;
  await page.goto(`chrome-extension://${id}/panel-preview.html?record=query&tab=Props`);
  const trigger = page
    .locator('.detail-title')
    .getByRole('button', { name: 'Search', exact: true });
  const bar = page.getByRole('search');
  const input = page.getByRole('textbox', { name: 'Search props' });

  await trigger.click();
  await expect(bar).toHaveCount(1);
  await expect(input).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-pressed', 'true');
  await trigger.click();
  await expect(bar).toHaveCount(0);
  await expect(trigger).toHaveAttribute('aria-pressed', 'false');

  await page.keyboard.press('Control+k');
  await expect(input).toBeFocused();
  await input.fill('Zoë');
  await expect(page.locator('.search-count')).toHaveText('1 / 3');
  await page.keyboard.press('Control+k');
  await expect(bar).toHaveCount(0);
  await expect(page.locator('mark')).toHaveCount(0);
  await page.keyboard.press('Control+k');
  await expect(input).toHaveValue('');
});
