# Changelog

## 0.1.0 — First release

Next.js Developer Tools is a Chrome extension that shows what a Next.js server sent to the browser, from SSR HTML and React Flight (RSC) payloads, without server log tools.

### Highlights

- **Detection** — The toolbar icon turns from gray to black on Next.js pages. Clicking it opens a React DevTools-style popup showing the router (App or Pages), the Next.js version, and the build mode (development or production).
- **Payload 🅝 DevTools panel** — Captures the initial document's `__next_f` Flight stream, client navigations, prefetches, server actions, `__NEXT_DATA__`, and `/_next/data` responses.
  - **Props** — Props passed to Client Components, and Pages Router `pageProps`.
  - **Tree** — The rendered tree.
  - **Logs** — Server console output, errors, async I/O, and server components.
  - **Meta** — Route metadata and HTTP headers.
  - **Raw** — Flight rows and the raw text.
- **Server data** — An expanded view of data the server fetched:
  - TanStack Query (`HydrationBoundary` and `dehydratedState`), SWR fallback, Apollo, Redux, urql, and streamed promises;
  - in `next dev`, every server-side `fetch` with its URL, status, headers, timing, and parsed JSON body.
- **Server logs in the browser** — In development, captures the Next.js 16 debug channel, so server `console.log`/`warn` output appears in the panel.
- **Search** — Searches inside every tab with Cmd/Ctrl+K, and also works with DevTools Cmd/Ctrl+F. Includes match case and a "Matching only" filter.
- **Settings** — Theme, density, time format, panel and search defaults, and capture limits. Available in the panel and on the options page.
