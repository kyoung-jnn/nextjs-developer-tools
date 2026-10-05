import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { summarizePagesData, summarizePagesDocument } from '../src/pages-router';

describe('Pages Router payloads', () => {
  it.each([
    ['gssp', 'getServerSideProps'],
    ['gsp', 'getStaticProps'],
    ['gip', 'getInitialProps'],
  ] as const)('recognizes document %s', (flag, method) => {
    expect(
      summarizePagesDocument({
        [flag]: true,
        page: '/legacy',
        buildId: 'build',
        query: { id: 'x' },
        props: { pageProps: { x: 1 } },
        isFallback: false,
        nextExport: true,
        autoExport: false,
      }),
    ).toMatchObject({
      page: '/legacy',
      buildId: 'build',
      query: { id: 'x' },
      pageProps: { x: 1 },
      dataFetching: [method],
      isFallback: false,
      nextExport: true,
      autoExport: false,
    });
  });
  it.each([
    ['__N_SSP', 'getServerSideProps'],
    ['__N_SSG', 'getStaticProps'],
  ] as const)('recognizes data %s', (flag, method) => {
    expect(summarizePagesData({ [flag]: true, pageProps: { x: 2 } })).toMatchObject({
      pageProps: { x: 2 },
      dataFetching: [method],
    });
  });
  it('summarizes real JSON fixtures and tolerates malformed input', () => {
    const doc = JSON.parse(
      readFileSync(new URL('./fixtures/pages-document-prod.txt', import.meta.url), 'utf8'),
    );
    const data = JSON.parse(
      readFileSync(new URL('./fixtures/pages-data-prod.txt', import.meta.url), 'utf8'),
    );
    expect(summarizePagesDocument(doc)).toMatchObject({
      page: '/legacy',
      dataFetching: ['getServerSideProps'],
    });
    expect(summarizePagesData(data).pageProps).toEqual(data.pageProps);
    expect(summarizePagesData(null)).toEqual({ raw: null, dataFetching: [] });
    expect(summarizePagesDocument([]).pageProps).toBeUndefined();
  });
});
