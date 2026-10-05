import { extractSegmentsFromScript, segmentsToBytes } from '@nextjs-devtools/flight-parser';
import actionMeta from '../../../../packages/flight-parser/tests/fixtures/next16-action-meta.json';
import action from '../../../../packages/flight-parser/tests/fixtures/next16-action-prod.txt';
import fetchDev from '../../../../packages/flight-parser/tests/fixtures/next16-fetch-dev.txt';
import fetchDevDebug from '../../../../packages/flight-parser/tests/fixtures/next16-fetch-dev-debug.txt';
import home from '../../../../packages/flight-parser/tests/fixtures/next16-home-prod.txt';
import navigation from '../../../../packages/flight-parser/tests/fixtures/next16-navigation-prod.txt';
import query from '../../../../packages/flight-parser/tests/fixtures/next16-query-prod.txt';
import dev from '../../../../packages/flight-parser/tests/fixtures/next16-streaming-dev.txt';
import devDebug from '../../../../packages/flight-parser/tests/fixtures/next16-streaming-dev-debug.txt';
import data from '../../../../packages/flight-parser/tests/fixtures/pages-data-prod.txt';
import pages from '../../../../packages/flight-parser/tests/fixtures/pages-document-prod.txt';
import { bytesToBase64 } from '../shared/base64';
import type { CaptureKind, WireRecord } from '../shared/types';
import type { DataSource } from './source';
export function createFixtureSource(): DataSource {
  const encoder = new TextEncoder();
  const record = (
    id: string,
    kind: CaptureKind,
    url: string,
    bytes: Uint8Array,
    extra: Partial<WireRecord> = {},
  ): WireRecord => ({
    id,
    kind,
    url,
    method: 'GET',
    status: 200,
    requestHeaders: {},
    responseHeaders: {
      'content-type': kind.startsWith('pages') ? 'application/json' : 'text/x-component',
    },
    startTime: 1791172800000,
    endTime: 1791172800082,
    chunks: [bytesToBase64(bytes)],
    done: true,
    debugChunks: [],
    debugDone: false,
    ...extra,
  });
  const records = [
    record(
      'query',
      'document',
      'http://localhost:3000/query',
      segmentsToBytes(extractSegmentsFromScript(query)),
    ),
    record(
      'app-document',
      'document',
      'http://localhost:3000/',
      segmentsToBytes(extractSegmentsFromScript(home)),
    ),
    record(
      'navigation',
      'navigation',
      'http://localhost:3000/blog/hello?_rsc=demo',
      encoder.encode(navigation),
      { requestHeaders: { rsc: '1' } },
    ),
    record('action', 'action', actionMeta.url, encoder.encode(action), actionMeta),
    record(
      'server-logs',
      'document',
      'http://localhost:3000/streaming (next dev)',
      segmentsToBytes(extractSegmentsFromScript(dev)),
      {
        endTime: 1791172801030,
        debugChunks: [bytesToBase64(encoder.encode(devDebug))],
        debugDone: true,
        requestId: 'fixture-debug',
      },
    ),
    record(
      'server-fetch',
      'document',
      'http://localhost:3000/fetch (next dev)',
      segmentsToBytes(extractSegmentsFromScript(fetchDev)),
      {
        endTime: 1791172801300,
        debugChunks: [bytesToBase64(encoder.encode(fetchDevDebug))],
        debugDone: true,
        requestId: 'fixture-fetch-debug',
      },
    ),
    record(
      'pages-document',
      'pages-document',
      'http://localhost:3000/legacy',
      encoder.encode(pages),
    ),
    record(
      'pages-data',
      'pages-data',
      'http://localhost:3000/_next/data/demo/legacy.json',
      encoder.encode(data),
      { requestHeaders: { 'x-nextjs-data': '1' } },
    ),
    record(
      'prefetch',
      'prefetch',
      'http://localhost:3000/blog/world?_rsc=demo',
      encoder.encode(navigation),
      { requestHeaders: { rsc: '1', 'next-router-prefetch': '1' } },
    ),
    record(
      'pages-prefetch',
      'pages-data',
      'http://localhost:3000/_next/data/demo/static.json',
      encoder.encode(data),
      { requestHeaders: { purpose: 'prefetch' } },
    ),
    record(
      'empty-data',
      'pages-data',
      'http://localhost:3000/_next/data/demo/legacy.json',
      new Uint8Array(),
    ),
  ];
  return {
    snapshot: () => ({
      url: 'http://localhost:3000/',
      detection: {
        isNext: true,
        router: 'app',
        version: '16.3.8',
        mode: 'production',
        signals: ['__next_f'],
      },
      records,
    }),
    subscribe: () => () => {},
  };
}
