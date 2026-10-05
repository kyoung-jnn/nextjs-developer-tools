import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SettingsForm } from '../settings-ui/SettingsForm';
import { useSettings } from '../settings-ui/useSettings';
import { extensionVersion, resolveTheme } from '../shared/settings';
import './options.css';

function OptionsApp() {
  const { settings, update, ready, saved } = useSettings();
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() =>
    globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
  const [error, setError] = useState('');
  useEffect(() => {
    const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    const changed = () => setSystemTheme(media?.matches ? 'dark' : 'light');
    media?.addEventListener('change', changed);
    return () => media?.removeEventListener('change', changed);
  }, []);
  const theme = resolveTheme(settings.theme, systemTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <main className="options-app" data-theme={theme}>
      <header>
        <h1>Settings</h1>
        <p>Next.js Developer Tools</p>
      </header>
      {error && (
        <p className="settings-error" role="alert">
          {error}
        </p>
      )}
      {ready ? (
        <SettingsForm
          settings={settings}
          saved={saved}
          version={extensionVersion()}
          onChange={(patch) => {
            setError('');
            void update(patch).catch(() => setError('Could not save settings. Try again.'));
          }}
        />
      ) : (
        <p className="options-loading">Loading settings…</p>
      )}
    </main>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<OptionsApp />);
