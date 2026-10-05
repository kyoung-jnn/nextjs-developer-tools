import type { CaptureKind } from '../shared/types';
export type PanelTab = 'Props' | 'Tree' | 'Logs' | 'Meta' | 'Raw';
const APP_TABS: readonly PanelTab[] = ['Props', 'Tree', 'Logs', 'Meta', 'Raw'];
const PAGES_TABS: readonly PanelTab[] = ['Props', 'Meta', 'Raw'];
export function tabsForRecord(kind: CaptureKind): readonly PanelTab[] {
  return kind === 'pages-document' || kind === 'pages-data' ? PAGES_TABS : APP_TABS;
}
export function tabForRecord(kind: CaptureKind, current?: string): PanelTab {
  return tabsForRecord(kind).find((tab) => tab === current) ?? 'Props';
}
export function logTabLabel(consoleCount: number, errorCount: number): string {
  const count = consoleCount + errorCount;
  return count ? `Logs ${count}` : 'Logs';
}
