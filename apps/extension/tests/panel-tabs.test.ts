import { describe, expect, it } from 'vitest';
import { logTabLabel, tabForRecord, tabsForRecord } from '../src/panel/tabs';
import type { CaptureKind } from '../src/shared/types';

describe('Panel tabs', () => {
  it.each<CaptureKind>(['document', 'navigation', 'prefetch', 'action', 'rsc'])(
    'uses consolidated App Router tabs for %s with Props as the default',
    (kind) => {
      expect(tabsForRecord(kind)).toEqual(['Props', 'Tree', 'Logs', 'Meta', 'Raw']);
      expect(tabForRecord(kind)).toBe('Props');
    },
  );
  it.each<CaptureKind>(['pages-document', 'pages-data'])(
    'uses exactly three Pages Router tabs for %s',
    (kind) => expect(tabsForRecord(kind)).toEqual(['Props', 'Meta', 'Raw']),
  );
  it('keeps supported selections and falls back to Props across routers', () => {
    expect(tabForRecord('pages-data', 'Meta')).toBe('Meta');
    expect(tabForRecord('pages-document', 'Raw')).toBe('Raw');
    expect(tabForRecord('pages-document', 'Tree')).toBe('Props');
    expect(tabForRecord('document', 'Logs')).toBe('Logs');
    expect(tabForRecord('document', 'Headers')).toBe('Props');
  });
  it('counts console entries and errors in the Logs label', () => {
    expect(logTabLabel(0, 0)).toBe('Logs');
    expect(logTabLabel(1, 2)).toBe('Logs 3');
  });
});
