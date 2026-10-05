import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  normalizeSettings,
  onSettingsChanged,
  type Settings,
  saveSettings,
} from '../shared/settings';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const mounted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const persisted = useRef<Settings>({ ...DEFAULT_SETTINGS });
  const pending = useRef(new Map<number, Partial<Settings>>());
  const revision = useRef(0);
  const persistedRevision = useRef(0);
  const publish = useCallback(() => {
    if (!mounted.current) return;
    let next = persisted.current;
    for (const patch of pending.current.values()) next = normalizeSettings({ ...next, ...patch });
    setSettings(next);
  }, []);
  useEffect(() => {
    mounted.current = true;
    let changed = false;
    const unsubscribe = onSettingsChanged((next) => {
      changed = true;
      persisted.current = next;
      persistedRevision.current++;
      publish();
    });
    void loadSettings()
      .then((next) => {
        if (mounted.current && !changed) {
          persisted.current = next;
          persistedRevision.current++;
          publish();
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted.current) setReady(true);
      });
    return () => {
      mounted.current = false;
      unsubscribe();
      clearTimeout(timer.current);
    };
  }, [publish]);
  const update = useCallback(
    async (patch: Partial<Settings>): Promise<void> => {
      const id = ++revision.current;
      const change = { ...patch };
      pending.current.set(id, change);
      publish();
      clearTimeout(timer.current);
      if (mounted.current) setSaved(false);
      const beforeSaveRevision = persistedRevision.current;
      try {
        const next = await saveSettings(change);
        const beforeReadRevision = persistedRevision.current;
        try {
          const latest = await loadSettings();
          if (persistedRevision.current === beforeReadRevision) {
            persisted.current = latest;
            persistedRevision.current++;
          }
        } catch {
          // A successful save stays successful even when the refresh is unavailable.
          // Use its response only if no storage notification has supplied a newer snapshot.
          if (persistedRevision.current === beforeSaveRevision) {
            persisted.current = next;
            persistedRevision.current++;
          }
        }
        pending.current.delete(id);
        publish();
        if (mounted.current && pending.current.size === 0) {
          setSaved(true);
          timer.current = setTimeout(() => setSaved(false), 1500);
        }
      } catch (error) {
        pending.current.delete(id);
        publish();
        const previousRevision = persistedRevision.current;
        try {
          const next = await loadSettings();
          if (persistedRevision.current === previousRevision) {
            persisted.current = next;
            persistedRevision.current++;
            publish();
          }
        } catch {
          /* Keep the last confirmed snapshot if storage is unavailable. */
        }
        throw error;
      }
    },
    [publish],
  );
  return { settings, update, ready, saved };
}
