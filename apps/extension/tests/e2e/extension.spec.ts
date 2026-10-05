import { collectClientProps, extractServerData } from '@nextjs-devtools/flight-parser';
import { DEV, decodeChunks, expect, PROD, parseCapture, test } from './fixtures';

test('App icon title (no badge), document Counter props, client navigation and server action', async ({
  extension,
}) => {
  const { page } = extension;
  await page.goto(PROD);
  await expect
    .poll(async () => await extension.badge())
    .toEqual({ text: '', title: 'Next.js 16.3.8 — App Router' });
  await expect
    .poll(async () =>
      (await extension.debugDump()).records.some(
        (r) => r.kind === 'document' && r.done && r.byteLength > 0,
      ),
    )
    .toBe(true);
  const record = (await extension.panelSnapshot()).find((r) => r.kind === 'document');
  expect(record).toBeDefined();
  if (!record) throw Error('No document');
  const parsed = parseCapture(record);
  const counter = collectClientProps(parsed).find(
    (client) => client.props.message === 'Hello 👋 — café data sent from the server',
  );
  expect(counter).toBeDefined();
  expect(counter?.props).toMatchObject({
    createdAt: { $flight: 'special', kind: 'date', value: '2026-10-05T00:00:00.000Z' },
    details: { user: { name: 'Next.js' }, tags: ['UTF-8', 'Flight'] },
    items: [1, 2, 3],
  });
  expect(
    Array.from(parsed.modules.values()).some((module) => module.moduleId === counter?.moduleId),
  ).toBe(true);
  await page.bringToFront();
  await page.locator('a[href="/blog/hello"]').click();
  await expect(page).toHaveURL(`${PROD}/blog/hello`);
  await expect
    .poll(async () =>
      (await extension.debugDump()).records.some((r) => r.kind === 'navigation' && r.done),
    )
    .toBe(true);
  await page.goto(`${PROD}/action`);
  await page.getByRole('button', { name: 'Submit action' }).click();
  await expect
    .poll(async () =>
      (await extension.debugDump()).records.some(
        (r) => r.kind === 'action' && r.done && r.byteLength > 0,
      ),
    )
    .toBe(true);
});
test('Pages title (no badge), document/data, and not-detected title on a non-Next HTTP page', async ({
  extension,
}) => {
  const { page } = extension;
  await page.goto(`${PROD}/legacy`);
  await expect.poll(async () => (await extension.badge()).title).toContain('Pages Router');
  expect((await extension.badge()).text).toBe('');
  await expect
    .poll(async () =>
      (await extension.debugDump()).records.some((r) => r.kind === 'pages-document' && r.done),
    )
    .toBe(true);
  const record = (await extension.panelSnapshot()).find((r) => r.kind === 'pages-document');
  expect(record).toBeDefined();
  if (!record) throw Error('No pages document');
  const data = JSON.parse(new TextDecoder().decode(decodeChunks(record.chunks)));
  expect(data.page).toBe('/legacy');
  expect(data.props.pageProps.time).toEqual(expect.any(String));
  await page.bringToFront();
  await page.getByRole('link', { name: 'Visit static page' }).click();
  await expect(page).toHaveURL(`${PROD}/static`);
  await expect.poll(async () => (await extension.badge()).title).toContain('Pages Router');
  expect((await extension.badge()).text).toBe('');
  await expect
    .poll(async () =>
      (await extension.debugDump()).records.some(
        (r) => r.kind === 'pages-data' && r.done && r.byteLength > 0,
      ),
    )
    .toBe(true);
  await page.route('http://plain.test/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><h1>Plain page</h1>' }),
  );
  await page.goto('http://plain.test/');
  await expect.poll(async () => (await extension.debugDump()).detection?.isNext).toBe(false);
  expect(await extension.badge()).toEqual({
    text: '',
    title: 'Next.js DevTools — Next.js not detected',
  });
});
test('Next dev client navigation captures live debug-channel log and warn rows', async ({
  extension,
}) => {
  const { page } = extension;
  await page.goto(DEV);
  await page.locator('a[href="/streaming"]').click();
  await expect(page).toHaveURL(`${DEV}/streaming`);
  await expect
    .poll(
      async () =>
        (await extension.debugDump()).records.some(
          (r) =>
            r.kind === 'navigation' &&
            r.url.includes('/streaming') &&
            Boolean(r.requestId) &&
            r.debugByteLength > 0 &&
            r.debugDone,
        ),
      { timeout: 30000 },
    )
    .toBe(true);
  const record = (await extension.panelSnapshot()).find(
    (r) => r.kind === 'navigation' && r.url.includes('/streaming') && r.debugChunks.length > 0,
  );
  expect(record?.requestId).toBeTruthy();
  if (!record) throw Error('No live navigation debug bytes');
  const logs = parseCapture(record).console;
  expect(
    logs.some(
      (entry) =>
        entry.method === 'log' && entry.args.includes('Streaming demo: delayed component ready'),
    ),
  ).toBe(true);
  expect(
    logs.some(
      (entry) =>
        entry.method === 'warn' && entry.args.includes('Streaming demo: sample server warning'),
    ),
  ).toBe(true);
});
test('Preview renders consolidated tabs, action props, metadata, ref rows and dark theme', async ({
  extension,
}) => {
  const id = new URL(extension.worker.url()).host;
  const base = `chrome-extension://${id}/panel-preview.html`;
  for (const [record, tab, text] of [
    ['app-document', 'Tree', '<html>'],
    ['app-document', 'Props', 'Hello 👋 — café data sent from the server'],
    ['server-logs', 'Logs', 'Streaming demo: delayed component ready'],
    ['pages-document', 'Props', 'pageProps'],
  ]) {
    await extension.page.goto(
      `${base}?${new URLSearchParams({ record: record ?? '', tab: tab ?? '', theme: 'light' })}`,
    );
    await expect(extension.page.locator('.detail-content')).toContainText(text ?? '');
    if (tab === 'Logs') {
      await expect(extension.page.locator('.detail-content')).toContainText(
        'Streaming demo: sample server warning',
      );
      await expect(extension.page.locator('.log-source')).toContainText('debug channel');
    }
  }
  await extension.page.goto(`${base}?record=app-document`);
  await expect(extension.page.getByRole('tab', { name: 'Props', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(await extension.page.getByRole('tab').allTextContents()).toEqual([
    'Props',
    'Tree',
    'Logs',
    'Meta',
    'Raw',
  ]);
  await extension.page.getByRole('tab', { name: 'Tree', exact: true }).click();
  await extension.page.locator('.request[title="http://localhost:3000/legacy"]').click();
  await expect(extension.page.getByRole('tab', { name: 'Props', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(await extension.page.getByRole('tab').allTextContents()).toEqual(['Props', 'Meta', 'Raw']);
  await extension.page.getByRole('tab', { name: 'Meta', exact: true }).click();
  await expect(extension.page.locator('.request-metadata')).toContainText(
    'n/a for the initial document',
  );
  await extension.page.locator('.request').filter({ hasText: '/action' }).click();
  await expect(extension.page.getByRole('tab', { name: 'Meta', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(extension.page.locator('.detail-content')).toContainText('Request');
  await extension.page.getByRole('tab', { name: 'Props', exact: true }).click();
  await expect(extension.page.locator('.detail-content')).toContainText('Action result');
  await expect(extension.page.locator('.detail-content')).toContainText(
    'Client component props: what Server Components passed',
  );
  await extension.page.goto(`${base}?record=server-logs&tab=Logs`);
  await expect(extension.page.getByRole('tab', { name: 'Logs 2', exact: true })).toBeVisible();
  await extension.page.locator('.log .ref').first().click();
  await expect(extension.page.getByRole('tab', { name: 'Raw', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(extension.page.getByRole('button', { name: 'Rows', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(extension.page.locator('.rows tr.selected')).toBeVisible();
  await extension.page.getByRole('button', { name: 'Text', exact: true }).click();
  await expect(extension.page.locator('pre.raw')).toBeVisible();
  await extension.page.goto(`${base}?record=app-document&tab=Tree&theme=dark`);
  await expect(extension.page.locator('[data-theme="dark"]')).toBeVisible();
  await expect(extension.page.locator('.detail-content')).toContainText('<html>');
});

test('Toolbar popup shows production, development, Pages Router and non-Next states', async ({
  extension,
}, testInfo) => {
  const { page, worker, context } = extension;
  const id = new URL(worker.url()).host;
  const popup = await context.newPage();
  await popup.emulateMedia({ colorScheme: 'dark' });
  await popup.goto(`chrome-extension://${id}/popup.html`);
  async function detection() {
    const tabId = await extension.activeTabId();
    return popup.evaluate(async (tabId) => {
      const result: unknown = await chrome.runtime.sendMessage({ type: 'get-detection', tabId });
      return result as import('../../src/shared/types').Detection | null;
    }, tabId);
  }
  async function inspect(name: string, expected: string) {
    const tabId = await extension.activeTabId();
    await popup.goto(`chrome-extension://${id}/popup.html?tabId=${tabId}`);
    await expect(popup.locator('h1')).toContainText(expected);
    await popup.locator('body').screenshot({ path: testInfo.outputPath(`popup-${name}.png`) });
  }
  await page.goto(PROD);
  await expect.poll(async () => (await detection())?.mode).toBe('production');
  await inspect('prod-app', 'production build of Next.js 16.3.8 (App Router). ✅');
  await expect(popup.locator('body')).toContainText('Payload 🅝');
  await page.goto(`${PROD}/legacy`);
  await expect.poll(async () => (await detection())?.mode).toBe('production');
  await expect.poll(async () => (await detection())?.router).toBe('pages');
  await inspect('pages', 'production build of Next.js 16.3.8 (Pages Router). ✅');
  await page.goto(DEV);
  await expect.poll(async () => (await detection())?.mode).toBe('development');
  await inspect('dev-app', 'development build of Next.js 16.3.8 (App Router). 🚧');
  await expect(popup.locator('body')).toContainText(
    'Server logs from Server Components appear under Logs.',
  );
  await page.goto(`${DEV}/legacy`);
  await expect.poll(async () => (await detection())?.mode).toBe('development');
  await expect.poll(async () => (await detection())?.router).toBe('pages');
  await inspect('dev-pages', 'development build of Next.js 16.3.8 (Pages Router). 🚧');
  await expect(popup.locator('body')).not.toContainText('Server logs from Server Components');
  await page.route('http://plain.test/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><h1>Plain page</h1>' }),
  );
  await page.goto('http://plain.test/');
  await expect.poll(async () => (await detection())?.isNext).toBe(false);
  await inspect('non-next', "This page doesn't appear to be using Next.js.");
});

test('Production query capture exposes resolved and streamed TanStack server data', async ({
  extension,
}) => {
  await extension.page.goto(`${PROD}/query`);
  await expect
    .poll(async () =>
      (await extension.debugDump()).records.some(
        (record) => record.kind === 'document' && record.done && record.byteLength > 0,
      ),
    )
    .toBe(true);
  const record = (await extension.panelSnapshot()).find((record) => record.kind === 'document');
  if (!record) throw Error('No query document');
  const queries = extractServerData(parseCapture(record)).filter(
    (entry) => entry.source === 'tanstack-query',
  );
  expect(queries).toHaveLength(2);
  expect(queries.map((entry) => entry.data)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ source: 'query-resolved', message: 'Hello 👋 — café' }),
      expect.objectContaining({ source: 'query-streamed', message: 'Hello 👋 — café' }),
    ]),
  );
  const id = new URL(extension.worker.url()).host;
  await extension.page.goto(`chrome-extension://${id}/panel-preview.html?record=query&tab=Props`);
  await expect(extension.page.locator('.server-data')).toContainText('TanStack Query · 2 queries');
  await expect(extension.page.locator('.server-data')).toContainText('Server data at the café ☕');
  await expect(extension.page.locator('.server-data')).toContainText('Zoë');
  await expect(extension.page.locator('.server-data')).toContainText('query-streamed');
  await expect(
    extension.page.getByRole('button', { name: 'Copy data', exact: true }).first(),
  ).toBeVisible();
});
test('Development fetch navigation exposes server I/O values', async ({ extension }) => {
  await extension.page.goto(DEV);
  await extension.page.locator('a[href="/fetch"]').click();
  await expect(extension.page).toHaveURL(`${DEV}/fetch`);
  await expect
    .poll(
      async () =>
        (await extension.debugDump()).records.some(
          (record) =>
            record.kind === 'navigation' &&
            record.url.includes('/fetch') &&
            record.debugByteLength > 0 &&
            record.debugDone,
        ),
      { timeout: 30000 },
    )
    .toBe(true);
  const record = (await extension.panelSnapshot()).find(
    (record) => record.kind === 'navigation' && record.url.includes('/fetch'),
  );
  if (!record) throw Error('No fetch navigation');
  const entries = extractServerData(parseCapture(record)).filter(
    (entry) => entry.source === 'server-io',
  );
  expect(
    entries.some((entry) => entry.label.includes('/api/posts') && entry.status === '200'),
  ).toBe(true);
  // The render-only fetch never reaches a Client Component, yet its JSON body is visible in dev.
  expect(entries.find((entry) => entry.label.includes('source=fetch-render-only'))).toMatchObject({
    status: '200',
    data: { source: 'fetch-render-only', message: 'Hello 👋 — café' },
  });
});
