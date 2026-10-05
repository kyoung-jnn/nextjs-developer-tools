import { useEffect, useId, useState } from 'react';
import { DEFAULT_SETTINGS, extensionVersion, type Settings } from '../shared/settings';
import './settings.css';

export interface SettingsFormProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  saved?: boolean;
  version?: string;
}

function NumberSetting({
  value,
  label,
  min,
  max,
  onChange,
}: {
  value: number;
  label: string;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <label className="settings-number">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={1}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          const number = event.target.valueAsNumber;
          if (Number.isInteger(number) && number >= min && number <= max) onChange(number);
        }}
        onBlur={() => {
          const number = Number(draft);
          if (draft === '' || !Number.isFinite(number)) setDraft(String(value));
          else {
            const normalized = Math.max(min, Math.min(max, Math.round(number)));
            setDraft(String(normalized));
            if (normalized !== value) onChange(normalized);
          }
        }}
      />
    </label>
  );
}

export function SettingsForm({
  settings,
  onChange,
  saved = false,
  version = extensionVersion(),
}: SettingsFormProps) {
  const id = useId();
  const [confirmReset, setConfirmReset] = useState(false);
  const segmented = (
    key: 'theme' | 'density' | 'timeFormat',
    label: string,
    values: readonly string[],
  ) => (
    <fieldset className="settings-field">
      <legend>{label}</legend>
      <div className="settings-segments">
        {values.map((value) => (
          <button
            key={value}
            type="button"
            className="toggle-button"
            aria-pressed={settings[key] === value}
            onClick={() => onChange({ [key]: value })}
          >
            {value === 'iso' ? 'ISO' : value[0]?.toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>
    </fieldset>
  );
  const checkbox = (key: keyof Settings, label: string) => (
    <label className="settings-check">
      <input
        type="checkbox"
        checked={Boolean(settings[key])}
        onChange={(event) => onChange({ [key]: event.target.checked })}
      />
      {label}
    </label>
  );
  const number = (
    key: 'jsonExpandDepth' | 'maxRecordsPerTab' | 'maxMegabytesPerTab',
    label: string,
    min: number,
    max: number,
  ) => (
    <NumberSetting
      value={settings[key]}
      label={label}
      min={min}
      max={max}
      onChange={(value) => onChange({ [key]: value })}
    />
  );
  return (
    <div className="settings-form">
      <section aria-labelledby={`${id}-appearance`}>
        <h3 id={`${id}-appearance`}>Appearance</h3>
        {segmented('theme', 'Theme', ['system', 'light', 'dark'])}
        {segmented('density', 'Density', ['compact', 'comfortable'])}
        {segmented('timeFormat', 'Time format', ['relative', 'local', 'iso'])}
      </section>
      <section aria-labelledby={`${id}-panel`}>
        <h3 id={`${id}-panel`}>Panel defaults</h3>
        <label className="settings-number">
          <span>Default tab</span>
          <select
            value={settings.defaultTab}
            onChange={(event) =>
              onChange({ defaultTab: event.target.value as Settings['defaultTab'] })
            }
          >
            {['Props', 'Tree', 'Logs', 'Meta', 'Raw'].map((tab) => (
              <option key={tab}>{tab}</option>
            ))}
          </select>
        </label>
        {checkbox('hidePrefetch', 'Hide prefetch requests')}
        {checkbox('preserveLog', 'Preserve log across navigation')}
        {checkbox('showFragments', 'Show fragments in Tree')}
        {checkbox('expandNextInternals', 'Expand Next.js internals')}
        {number('jsonExpandDepth', 'JSON expand depth', 1, 10)}
      </section>
      <section aria-labelledby={`${id}-search`}>
        <h3 id={`${id}-search`}>Search</h3>
        {checkbox('searchCaseSensitive', 'Case sensitive')}
        {checkbox('searchMatchingOnly', 'Show matching rows only')}
      </section>
      <section aria-labelledby={`${id}-capture`}>
        <h3 id={`${id}-capture`}>Capture</h3>
        <p className="settings-hint">Applies after the page reloads</p>
        {checkbox('capturePrefetch', 'Capture prefetch requests')}
        {number('maxRecordsPerTab', 'Maximum records per tab', 50, 1000)}
        {number('maxMegabytesPerTab', 'Maximum megabytes per tab', 10, 200)}
      </section>
      <footer className="settings-footer">
        <span className="settings-saved" role="status" aria-live="polite">
          {saved ? 'Saved' : ''}
        </span>
        {confirmReset ? (
          <div className="settings-reset-confirm">
            <span>Reset all settings?</span>
            <button
              type="button"
              onClick={() => {
                onChange({ ...DEFAULT_SETTINGS });
                setConfirmReset(false);
              }}
            >
              Reset
            </button>
            <button type="button" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmReset(true)}>
            Reset to defaults
          </button>
        )}
        {version && (
          <small className="settings-version">
            {version === 'Preview' ? version : `Version ${version}`}
          </small>
        )}
      </footer>
    </div>
  );
}

export { SettingsForm as SharedSettingsForm };
