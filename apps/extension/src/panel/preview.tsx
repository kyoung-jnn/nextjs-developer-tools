import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createFixtureSource } from './fixtureSource';
import { PanelApp } from './PanelApp';
import { browserActions } from './platform';
import './panel.css';

const params = new URLSearchParams(location.search);
const source = createFixtureSource();
function PreviewApp() {
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() =>
    matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const changed = () => setSystemTheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  const theme =
    params.get('theme') === 'dark'
      ? 'dark'
      : params.get('theme') === 'light'
        ? 'light'
        : systemTheme;
  const actions = useMemo(() => browserActions(theme, () => location.reload()), [theme]);
  return (
    <PanelApp
      source={source}
      actions={actions}
      initialRecord={params.get('record') ?? 'app-document'}
      initialTab={params.get('tab') ?? undefined}
      initialSearch={params.get('search') ?? ''}
    />
  );
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<PreviewApp />);
