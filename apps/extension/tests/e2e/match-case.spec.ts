import { expect, test } from './fixtures';

for (const theme of ['light', 'dark'] as const) {
  for (const tab of ['Props', 'Raw'] as const) {
    test(`Match case is styled, preserves focus and toggles via Alt+C in ${theme} ${tab}`, async ({
      extension,
    }) => {
      const { page, worker } = extension;
      const id = new URL(worker.url()).host;
      await page.goto(
        `chrome-extension://${id}/panel-preview.html?record=query&tab=${tab}&theme=${theme}&search=zo%C3%AB`,
      );
      if (tab === 'Raw') await page.getByRole('button', { name: 'Text', exact: true }).click();
      const input = page.getByRole('textbox', {
        name: tab === 'Props' ? 'Search props' : 'Search raw',
      });
      const toggle = page.getByRole('button', { name: 'Match case', exact: true });
      // Props: two TanStack cards + one client prop. Raw searches the Flight text: two occurrences.
      const all = tab === 'Props' ? '1 / 3' : '1 / 2';
      const shortcut = await page.evaluate(() => {
        const platform =
          (navigator as Navigator & { userAgentData?: { platform: string } }).userAgentData
            ?.platform ?? navigator.platform;
        return /mac/i.test(platform) ? '⌥C' : 'Alt+C';
      });
      await expect(toggle).toHaveAttribute('title', `Match case (${shortcut})`);
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('.search-count')).toHaveText(all);
      await input.focus();
      await input.evaluate((element: HTMLInputElement) => element.setSelectionRange(1, 1));
      const neutral = await toggle.evaluate((element) => getComputedStyle(element).backgroundColor);
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      expect(
        await toggle.evaluate((element) => getComputedStyle(element).backgroundColor),
      ).not.toBe(neutral);
      await expect(page.locator('.search-count')).toHaveText('No matches');
      await expect(input).toBeFocused();
      expect(await input.evaluate((element: HTMLInputElement) => element.selectionStart)).toBe(1);
      await page.keyboard.press('Alt+c');
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('.search-count')).toHaveText(all);
      await expect(input).toBeFocused();
      // Option+C may produce ç: the physical code, not the character, controls the shortcut.
      await input.evaluate((element) =>
        element.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'ç',
            code: 'KeyC',
            altKey: true,
            bubbles: true,
            cancelable: true,
          }),
        ),
      );
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.search-count')).toHaveText('No matches');
    });
  }
}
