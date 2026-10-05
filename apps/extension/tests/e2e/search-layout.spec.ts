import { expect, test } from './fixtures';

for (const theme of ['light', 'dark'] as const) {
  for (const density of ['compact', 'comfortable'] as const) {
    test(`Search row stays above scrolling content with ${theme} theme and ${density} density`, async ({
      extension,
    }) => {
      const { page, worker } = extension;
      const id = new URL(worker.url()).host;
      await page.setViewportSize({ width: 1440, height: 600 });
      await worker.evaluate(
        async ({ theme, density }) => {
          await chrome.storage.sync.set({
            settings: {
              version: 1,
              theme,
              density,
              expandNextInternals: true,
              jsonExpandDepth: 10,
            },
          });
        },
        { theme, density },
      );
      await page.goto(`chrome-extension://${id}/panel-preview.html?record=server-fetch&tab=Props`);
      await expect(page.locator('.panel-app')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('.panel-app')).toHaveAttribute('data-density', density);
      const shortcut = await page.evaluate(() => {
        const platform =
          (navigator as Navigator & { userAgentData?: { platform: string } }).userAgentData
            ?.platform ?? navigator.platform;
        return /mac/i.test(platform) ? '⌘K' : 'Ctrl+K';
      });
      const trigger = page.getByRole('button', { name: 'Search', exact: true });
      // 10-search §12: an input-looking trigger in the title row, never inside the tab strip.
      await expect(page.locator('.detail-title .search-trigger')).toHaveCount(1);
      await expect(page.locator('.tabs')).not.toContainText('Search');
      await expect(page.locator('.tabs > :not([role="tab"])')).toHaveCount(0);
      await expect(trigger).toHaveText(`🔍 Search ${shortcut}`);
      await expect(trigger.locator('kbd')).toHaveText(shortcut);
      await expect(trigger).toHaveAttribute('title', `Search (${shortcut})`);
      await expect(trigger).toHaveAttribute('aria-pressed', 'false');
      await trigger.click();
      const bar = page.getByRole('search');
      const input = page.getByRole('textbox', { name: 'Search props' });
      await expect(input).toHaveAttribute('placeholder', `Search props (${shortcut})`);
      await expect(bar).toContainText('Enter ↓ · ⇧Enter ↑ · Esc close');
      await expect(input).toBeFocused();
      await expect(trigger).toHaveAttribute('aria-pressed', 'true');
      await expect(trigger).toHaveAttribute('title', `Close search (${shortcut})`);
      // 10-search §13: the button never mirrors the query.
      await input.fill('posts');
      await expect(trigger).toHaveText(`🔍 Search ${shortcut}`);
      await expect(page.locator('.detail-content .search-bar')).toHaveCount(0);
      const controls = [
        page.getByRole('button', { name: 'Clear', exact: true }),
        page.getByRole('button', { name: 'Reload', exact: true }),
        page.getByRole('button', { name: 'Settings', exact: true }),
        input,
        page.getByRole('button', { name: 'Next match', exact: true }),
      ];
      const expectedHeight = density === 'compact' ? 24 : 28;
      for (const control of controls) {
        const box = await control.boundingBox();
        expect(box).not.toBeNull();
        expect(box?.height).toBe(expectedHeight);
      }
      const settingsBox = await page
        .getByRole('button', { name: 'Settings', exact: true })
        .boundingBox();
      expect(settingsBox?.width).toBe(expectedHeight);
      const tabsBox = await page.locator('.tabs').boundingBox();
      const barBefore = await bar.boundingBox();
      const content = page.locator('.detail-content');
      const contentBefore = await content.boundingBox();
      if (!tabsBox || !barBefore || !contentBefore) throw Error('Missing panel layout boxes');
      expect(Math.abs(tabsBox.y + tabsBox.height - barBefore.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(barBefore.y + barBefore.height - contentBefore.y)).toBeLessThanOrEqual(1);
      const padding = await page.evaluate(() => {
        const bar = document.querySelector('.search-bar');
        const content = document.querySelector('.detail-content');
        if (!bar || !content) throw Error('Missing search row');
        return {
          bar: getComputedStyle(bar).paddingLeft,
          content: getComputedStyle(content).paddingLeft,
        };
      });
      expect(padding.bar).toBe(padding.content);
      await expect
        .poll(() => content.evaluate((element) => element.scrollHeight - element.clientHeight))
        .toBeGreaterThan(200);
      await content.evaluate((element) => {
        element.scrollTop = 200;
      });
      await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBe(200);
      expect(await bar.boundingBox()).toEqual(barBefore);
      const clipped = await page.evaluate(() => {
        const bar = document.querySelector('.search-bar');
        const content = document.querySelector('.detail-content');
        if (!bar || !content) throw Error('Missing search row');
        const box = bar.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + 12, box.y + box.height / 2);
        return {
          barOnTop: hit !== null && bar.contains(hit),
          overflow: getComputedStyle(content).overflowY,
        };
      });
      expect(clipped).toEqual({ barOnTop: true, overflow: 'auto' });
      await page.getByRole('tab', { name: 'Raw', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'Search raw' })).toHaveAttribute(
        'placeholder',
        `Search raw (${shortcut})`,
      );
      await expect(page.locator('.detail-content .search-bar')).toHaveCount(0);
    });
  }
}
