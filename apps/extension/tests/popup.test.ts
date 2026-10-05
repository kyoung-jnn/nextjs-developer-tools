import { describe, expect, it } from 'vitest';
import { popupContent } from '../src/popup/content';
import type { Detection } from '../src/shared/types';

const app: Detection = { isNext: true, router: 'app', version: '16.3.8', signals: [] };
const body = 'Open the developer tools, and the "Payload 🅝" tab will appear to the right.';
describe('Toolbar popup copy', () => {
  it.each([null, { isNext: false, router: null, signals: [] }])(
    'explains absent detection %j',
    (detection) => {
      expect(popupContent(detection as Detection | null)).toEqual({
        title: "This page doesn't appear to be using Next.js.",
        body: 'If this seems wrong, reload the page. Detection runs when the page loads.',
        details: [],
        tone: 'none',
      });
    },
  );
  it('shows production and known details', () => {
    expect(popupContent({ ...app, mode: 'production', buildId: 'build' })).toEqual({
      title: 'This page is using the production build of Next.js 16.3.8 (App Router). ✅',
      body,
      tone: 'ok',
      details: [
        ['Router', 'App Router'],
        ['Version', '16.3.8'],
        ['Build', 'production'],
        ['Build ID', 'build'],
      ],
    });
  });
  it.each(['app', 'pages'] as const)('shows development copy for %s', (router) => {
    const content = popupContent({ ...app, mode: 'development', router });
    expect(content.title).toBe(
      `This page is using the development build of Next.js 16.3.8 (${router === 'app' ? 'App Router' : 'Pages Router'}). 🚧`,
    );
    expect(content.body).toBe(
      body + (router === 'app' ? ' Server logs from Server Components appear under Logs.' : ''),
    );
    expect(content.tone).toBe('dev');
  });
  it('omits the build phrase when mode is unknown', () => {
    expect(popupContent(app).title).toBe('This page is using Next.js 16.3.8 (App Router).');
    expect(popupContent(app).body).toBe(body);
    expect(popupContent(app).details).toEqual([
      ['Router', 'App Router'],
      ['Version', '16.3.8'],
    ]);
  });
  it('omits unknown router and missing version', () => {
    expect(popupContent({ ...app, router: 'unknown' }).title).toBe(
      'This page is using Next.js 16.3.8.',
    );
    expect(popupContent({ isNext: true, router: 'pages', signals: [] }).title).toBe(
      'This page is using Next.js (Pages Router).',
    );
    expect(popupContent({ isNext: true, router: 'unknown', signals: [] }).details).toEqual([]);
  });
});
