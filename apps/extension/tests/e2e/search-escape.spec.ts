import { expect, test } from './fixtures';

test('Open search consumes Escape before the DevTools forwarder and closed search leaves it alone', async ({
  extension,
}) => {
  const { page, worker } = extension;
  const id = new URL(worker.url()).host;
  await page.goto(`chrome-extension://${id}/panel-preview.html?record=query&search=Zo%C3%AB`);
  await page.evaluate(() => {
    const keys: string[] = [];
    Object.assign(window, { forwardedSearchKeys: keys });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' || event.key === 'Enter') keys.push(event.key);
    });
  });
  const forwarded = () =>
    page.evaluate(
      () => (window as Window & { forwardedSearchKeys?: string[] }).forwardedSearchKeys,
    );
  const search = page.getByRole('search');
  const input = page.getByRole('textbox', { name: 'Search props' });
  await expect(search).toBeVisible();
  await expect(input).toBeFocused();
  await input.press('Enter');
  await expect(page.locator('.search-count')).toHaveText('2 / 3');
  await input.press('Shift+Enter');
  await expect(page.locator('.search-count')).toHaveText('1 / 3');
  expect(await forwarded()).toEqual([]);
  await input.press('Escape');
  await expect(search).toHaveCount(0);
  await expect(page.locator('.detail-content')).toBeFocused();
  expect(await forwarded()).toEqual([]);
  await page.keyboard.press('Escape');
  expect(await forwarded()).toEqual(['Escape']);
  // Capture must consume Escape even when focus has left the open search bar.
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(search).toBeVisible();
  await page.getByRole('textbox', { name: 'Filter URL' }).focus();
  await page.keyboard.press('Escape');
  await expect(search).toHaveCount(0);
  await expect(page.locator('.detail-content')).toBeFocused();
  expect(await forwarded()).toEqual(['Escape']);
});
