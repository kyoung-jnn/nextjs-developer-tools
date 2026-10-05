# Privacy Policy — Next.js Developer Tools

_Effective date: October 6, 2026_

Next.js Developer Tools ("the extension") is a Chrome DevTools extension for developers. It shows what a Next.js server sent to the browser. This policy explains what the extension accesses and what it does with that data.

## Summary

- The extension **does not collect, sell, or share any personal data**.
- All processing happens **locally in your browser**. No data is sent to the developer or to any third party, and the extension contacts no remote server.
- The extension has no analytics, telemetry, ads, or tracking, and it does not use remote code.

## What the extension accesses

To do its single purpose, the extension runs content scripts on `http` and `https` pages:

1. **Detection.** It checks whether the current page is built with Next.js, for example from Next.js globals, the `__NEXT_DATA__` script, and `/_next/` assets. This lets the toolbar icon and popup show the router, Next.js version, and build mode.
2. **Payload capture (Next.js pages only).** It records that page's own Next.js data so it can be shown in the "Payload 🅝" DevTools panel. That data is:
   - inline React Server Components (Flight) data;
   - RSC and `/_next/data` responses the page fetches;
   - the page's `__NEXT_DATA__`;
   - in development mode, the Next.js development debug channel (server logs and debug information sent by your own `next dev` server).

On pages that are not built with Next.js, no page data is captured.

## How the data is handled

- Captured data stays in memory in the tab where it was captured. Its size is limited by the capture limits in the extension's settings. It is discarded when the page is unloaded or the tab is closed.
- It is passed only between the extension's own components (content script, service worker, and DevTools panel) in your browser, so it can be shown in the panel.
- It is never written to remote storage, transmitted over the network, or shared with anyone.

## What the extension stores

- **Settings** such as theme, density, time format, panel and search defaults, and capture limits are stored with `chrome.storage.sync`. If you use Chrome Sync, Chrome may sync these settings across your own signed-in browsers. They contain no page data.
- **Per-tab detection state** (whether a tab is a Next.js page, plus its router, version, build mode, and build ID) is stored with `chrome.storage.session`. Chrome clears this storage when the browser session ends.

## Permissions

- `storage`: to save the settings and detection state described above.
- Content scripts on `http://*/*` and `https://*/*`: Next.js applications can be hosted on any domain, including `localhost`. Detection and capture therefore have to run on any page, and the data never leaves your browser.

## Children's privacy

The extension is a developer tool, it does not knowingly process data from children, and it collects no data from anyone.

## Changes to this policy

If this policy changes, the updated version will be published at this URL with a new effective date.

## Contact

For questions about this policy, open an issue at <https://github.com/kyoung-jnn/nextjs-developer-tools/issues>.
