import { fileURLToPath } from 'node:url';
import { buildPayload, mergePayloadRows, parseFlight } from '@nextjs-devtools/flight-parser';
import { type BrowserContext, test as base, type Page, type Worker } from '@playwright/test';
import { base64ToBytes } from '../../src/shared/base64';
import type { BackgroundToPanelMessage } from '../../src/shared/messages';
import type { CaptureKind, Detection, WireRecord } from '../../src/shared/types';
export const PROD = 'http://localhost:3210';
export const DEV = 'http://localhost:3211';
export function decodeChunks(chunks: string[]): Uint8Array {
  const parts = chunks.map(base64ToBytes);
  const output = new Uint8Array(parts.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}
export function parseCapture(record: WireRecord) {
  return buildPayload(
    mergePayloadRows(
      parseFlight(decodeChunks(record.chunks)).rows,
      parseFlight(decodeChunks(record.debugChunks)).rows,
    ),
  );
}
interface DumpSummary {
  url: string;
  detection: Detection | null;
  records: {
    id: string;
    kind: CaptureKind;
    url: string;
    byteLength: number;
    done: boolean;
    requestId?: string;
    debugByteLength: number;
    debugDone: boolean;
  }[];
}
interface Extension {
  context: BrowserContext;
  page: Page;
  worker: Worker;
  activeTabId(): Promise<number>;
  debugDump(): Promise<DumpSummary>;
  panelSnapshot(): Promise<WireRecord[]>;
  badge(): Promise<{ text: string; title: string }>;
}
export const test = base.extend<{ extension: Extension }>({
  extension: async ({ playwright }, use, testInfo) => {
    const dist = fileURLToPath(new URL('../../dist', import.meta.url));
    const context = await playwright.chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
      viewport: { width: 1440, height: 960 },
    });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    try {
      const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
      for (const blank of context.pages()) await blank.close();
      const page = await context.newPage();
      const extensionId = new URL(worker.url()).host;
      let inspector: Page | undefined;
      const activeTabId = async () => {
        await page.bringToFront();
        return worker.evaluate(async () => {
          const tabs = await chrome.tabs.query({ active: true });
          const id = tabs[0]?.id;
          if (id === undefined) throw Error('No active tab');
          return id;
        });
      };
      await use({
        context,
        page,
        worker,
        activeTabId,
        debugDump: async () =>
          worker.evaluate(
            async (id) => {
              const response: unknown = await chrome.tabs.sendMessage(id, { type: 'debug-dump' });
              return response as DumpSummary;
            },
            await activeTabId(),
          ),
        badge: async () =>
          worker.evaluate(
            async (id) => ({
              text: await chrome.action.getBadgeText({ tabId: id }),
              title: await chrome.action.getTitle({ tabId: id }),
            }),
            await activeTabId(),
          ),
        panelSnapshot: async () => {
          const id = await activeTabId();
          if (!inspector) {
            inspector = await context.newPage();
            await inspector.goto(`chrome-extension://${extensionId}/panel-preview.html`);
          }
          return inspector.evaluate(
            (tab) =>
              new Promise<WireRecord[]>((resolve, reject) => {
                const port = chrome.runtime.connect({ name: 'panel' });
                const timer = setTimeout(() => {
                  port.disconnect();
                  reject(Error('Panel snapshot timed out'));
                }, 10000);
                port.onMessage.addListener((message: BackgroundToPanelMessage) => {
                  if (message.type === 'snapshot') {
                    clearTimeout(timer);
                    port.disconnect();
                    resolve(message.records);
                  }
                });
                port.onDisconnect.addListener(() => {
                  void chrome.runtime.lastError;
                });
                port.postMessage({ type: 'attach', tabId: tab });
              }),
            id,
          );
        },
      });
    } finally {
      await context.tracing.stop(
        testInfo.status !== testInfo.expectedStatus
          ? { path: testInfo.outputPath('trace.zip') }
          : undefined,
      );
      await context.close();
    }
  },
});
export { expect } from '@playwright/test';
