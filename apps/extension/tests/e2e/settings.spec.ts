import { expect, PROD, test } from './fixtures';

test('Settings drawer applies appearance live and retains it after reload', async ({
  extension,
}) => {
  const { page, worker } = extension;
  const id = new URL(worker.url()).host;
  await page.goto(`chrome-extension://${id}/panel-preview.html?record=app-document`);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Appearance', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.locator('[data-theme="dark"]')).toBeVisible();
  await page.getByRole('button', { name: 'Comfortable', exact: true }).click();
  await expect(page.locator('[data-density="comfortable"]')).toBeVisible();
  await expect
    .poll(() => worker.evaluate(async () => (await chrome.storage.sync.get('settings')).settings))
    .toMatchObject({ version: 1, theme: 'dark', density: 'comfortable' });
  await page.reload();
  await expect(page.locator('[data-theme="dark"]')).toBeVisible();
  await expect(page.locator('[data-density="comfortable"]')).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dark', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Comfortable', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Reset to defaults', exact: true }).click();
  await expect(page.getByText('Reset all settings?', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('[data-theme="dark"]')).toBeVisible();
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Appearance', exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('.detail-title').click();
  await expect(page.getByRole('heading', { name: 'Appearance', exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Appearance', exact: true })).not.toBeVisible();
});

test('Options form saves settings and syncs them into an open panel', async ({ extension }) => {
  const { page: panel, worker, context } = extension;
  const id = new URL(worker.url()).host;
  await panel.goto(`chrome-extension://${id}/panel-preview.html?record=app-document`);
  const options = await context.newPage();
  await options.goto(`chrome-extension://${id}/options.html`);
  await expect(options.getByRole('heading', { name: 'Appearance', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Settings', exact: true }).click();
  await Promise.all([
    panel.getByRole('button', { name: 'Dark', exact: true }).click(),
    options.getByRole('button', { name: 'Comfortable', exact: true }).click(),
  ]);
  await expect(panel.locator('[data-theme="dark"]')).toBeVisible();
  await expect(panel.locator('[data-density="comfortable"]')).toBeVisible();
  await expect
    .poll(() => worker.evaluate(async () => (await chrome.storage.sync.get('settings')).settings))
    .toMatchObject({ version: 1, theme: 'dark', density: 'comfortable' });
  await options.getByRole('checkbox', { name: 'Capture prefetch requests', exact: true }).uncheck();
  await expect
    .poll(() => worker.evaluate(async () => (await chrome.storage.sync.get('settings')).settings))
    .toMatchObject({ version: 1, theme: 'dark', density: 'comfortable', capturePrefetch: false });
  await expect(
    panel.getByRole('checkbox', { name: 'Capture prefetch requests', exact: true }),
  ).not.toBeChecked();
  await options.reload();
  await expect(
    options.getByRole('checkbox', { name: 'Capture prefetch requests', exact: true }),
  ).not.toBeChecked();
  await panel.getByRole('button', { name: 'Light', exact: true }).click();
  await expect(options.locator('.options-app[data-theme="light"]')).toBeVisible();
  await expect(options.getByRole('button', { name: 'Light', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('Configured default tab applies initially and record changes preserve the current supported tab', async ({
  extension,
}) => {
  const { page, worker } = extension;
  const id = new URL(worker.url()).host;
  await worker.evaluate(async () => {
    await chrome.storage.sync.set({ settings: { version: 1, defaultTab: 'Tree' } });
  });
  await page.goto(`chrome-extension://${id}/panel-preview.html?record=app-document`);
  await expect(page.getByRole('tab', { name: 'Tree', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('tab', { name: 'Props', exact: true }).click();
  await page.locator('.request[title="http://localhost:3000/blog/hello?_rsc=demo"]').click();
  await expect(page.getByRole('tab', { name: 'Props', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('tab', { name: 'Tree', exact: true }).click();
  await page.locator('.request[title="http://localhost:3000/legacy"]').click();
  await expect(page.getByRole('tab', { name: 'Props', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('tab', { name: 'Tree', exact: true })).toHaveCount(0);
});

test('Disabling prefetch capture after reload preserves document and navigation capture', async ({
  extension,
}) => {
  const { page, worker } = extension;
  async function prefetch() {
    await page.evaluate(async () => {
      const response = await fetch('/blog/hello?_rsc=settings-prefetch', {
        headers: { rsc: '1', 'next-router-prefetch': '1' },
      });
      if (!response.ok) throw Error(`Prefetch failed: ${response.status}`);
      await response.text();
    });
  }
  await page.goto(PROD);
  await prefetch();
  await expect
    .poll(async () =>
      (await extension.debugDump()).records.some(
        (record) => record.kind === 'prefetch' && record.done,
      ),
    )
    .toBe(true);
  await worker.evaluate(async () => {
    const stored = (await chrome.storage.sync.get('settings')).settings;
    await chrome.storage.sync.set({
      settings: {
        ...(stored && typeof stored === 'object' ? stored : {}),
        version: 1,
        capturePrefetch: false,
      },
    });
  });
  await page.reload();
  await expect
    .poll(async () =>
      (await extension.debugDump()).records.some(
        (record) => record.kind === 'document' && record.done && record.byteLength > 0,
      ),
    )
    .toBe(true);
  await prefetch();
  await page.evaluate(async () => {
    const response = await fetch('/blog/hello?_rsc=settings-navigation', { headers: { rsc: '1' } });
    if (!response.ok) throw Error(`Navigation failed: ${response.status}`);
    await response.text();
  });
  await expect
    .poll(async () =>
      (await extension.debugDump()).records.some(
        (record) =>
          record.kind === 'navigation' &&
          new URL(record.url).pathname === '/blog/hello' &&
          record.done &&
          record.byteLength > 0,
      ),
    )
    .toBe(true);
  expect(
    (await extension.debugDump()).records.filter((record) => record.kind === 'prefetch'),
  ).toEqual([]);
});

test('Popup Settings opens the extension options page', async ({ extension }) => {
  const { page, worker, context } = extension;
  const id = new URL(worker.url()).host;
  await page.goto(`chrome-extension://${id}/popup.html`);
  const optionsOpened = context.waitForEvent('page');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const options = await optionsOpened;
  await expect(options).toHaveURL(`chrome://extensions/?options=${id}`);
  await expect(
    options.getByRole('dialog', { name: 'Next.js Developer Tools', exact: true }),
  ).toBeVisible();
  // Embedded Chrome options use a guest view rather than a normal Playwright iframe.
  // The shared form itself is exercised directly in the options-page test above.
  await expect(options.locator('extensionoptions')).toHaveAttribute('extension', id);
});
