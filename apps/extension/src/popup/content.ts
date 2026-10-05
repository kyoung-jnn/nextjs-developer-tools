import type { Detection } from '../shared/types';

export interface PopupContent {
  title: string;
  body: string;
  details: [string, string][];
  tone: 'ok' | 'dev' | 'none';
}

export function popupContent(detection: Detection | null): PopupContent {
  if (!detection?.isNext)
    return {
      title: "This page doesn't appear to be using Next.js.",
      body: 'If this seems wrong, reload the page. Detection runs when the page loads.',
      details: [],
      tone: 'none',
    };
  const router =
    detection.router === 'app'
      ? 'App Router'
      : detection.router === 'pages'
        ? 'Pages Router'
        : undefined;
  const name = `Next.js${detection.version ? ` ${detection.version}` : ''}${router ? ` (${router})` : ''}`;
  const build = detection.mode ? `the ${detection.mode} build of ` : '';
  const emoji =
    detection.mode === 'production' ? ' ✅' : detection.mode === 'development' ? ' 🚧' : '';
  const details: [string, string][] = [];
  if (router) details.push(['Router', router]);
  if (detection.version) details.push(['Version', detection.version]);
  if (detection.mode) details.push(['Build', detection.mode]);
  if (detection.buildId) details.push(['Build ID', detection.buildId]);
  return {
    title: `This page is using ${build}${name}.${emoji}`,
    body:
      'Open the developer tools, and the "Payload 🅝" tab will appear to the right.' +
      (detection.mode === 'development' && detection.router === 'app'
        ? ' Server logs from Server Components appear under Logs.'
        : ''),
    details,
    tone: detection.mode === 'development' ? 'dev' : 'ok',
  };
}
