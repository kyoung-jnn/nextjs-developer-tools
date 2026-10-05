import { useEffect, useRef } from 'react';
import { SettingsForm } from '../settings-ui/SettingsForm';
import type { Settings } from '../shared/settings';

export function SettingsDrawer({
  settings,
  onChange,
  saved,
  onClose,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  saved: boolean;
  onClose: () => void;
}) {
  const drawer = useRef<HTMLElement>(null);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !drawer.current?.contains(event.target)) onClose();
    };
    window.addEventListener('keydown', key);
    window.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('pointerdown', outside);
    };
  }, [onClose]);
  return (
    <aside className="settings-drawer" aria-label="Settings drawer" ref={drawer}>
      <header>
        <h2>Settings</h2>
        <button type="button" aria-label="Close settings" onClick={onClose}>
          ×
        </button>
      </header>
      <SettingsForm settings={settings} onChange={onChange} saved={saved} />
    </aside>
  );
}
