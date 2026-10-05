import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeJson } from '../src/decode';
import { extractSegmentsFromScript, segmentsToBytes } from '../src/next-f';
import { buildPayload, mergePayloadRows, parseFlight } from '../src/payload';
import { extractServerData } from '../src/server-data';

const parse = (text: string) => parseFlight(new TextEncoder().encode(text));
const client = (props: unknown, rows = '') =>
  parse(`0:["$","$L1",null,${JSON.stringify(props)}]\n1:I[42,[],"Posts"]\n${rows}`);
const query = (data: unknown = [{ id: 1 }]) => ({
  mutations: [],
  queries: [
    {
      queryKey: ['posts', 1],
      queryHash: 'posts',
      state: { data, status: 'success', dataUpdatedAt: 123, fetchStatus: 'idle', error: null },
    },
  ],
});

describe('Server data recognizers', () => {
  it('recognizes TanStack by shape independent of the prop name', () => {
    expect(extractServerData(client({ anything: query() }))).toEqual([
      expect.objectContaining({
        source: 'tanstack-query',
        location: 'Posts.anything',
        label: '["posts",1]',
        data: [{ id: 1 }],
        status: 'success',
        updatedAt: 123,
      }),
    ]);
  });
  it.each(['dehydratedState', 'trpcState'])('recognizes Pages %s', (key) => {
    expect(extractServerData({ [key]: query() })[0]).toMatchObject({
      source: 'tanstack-query',
      location: `pageProps.${key}`,
    });
  });
  it('resolves streamed TanStack promises through paths and nested references', () => {
    const state = {
      mutations: [],
      queries: [{ queryKey: ['streamed'], state: { status: 'pending' }, promise: '$@2:data' }],
    };
    expect(
      extractServerData(client({ state }, '2:{"data":{"posts":"$3"}}\n3:[{"id":2}]\n'))[0],
    ).toMatchObject({
      source: 'tanstack-query',
      status: 'streamed',
      data: { posts: [{ id: 2 }] },
      meta: { streamed: true },
    });
  });
  it('keeps unresolved query promises pending', () => {
    const state = {
      mutations: [],
      queries: [{ queryKey: ['pending'], state: { status: 'pending' }, promise: '$@9' }],
    };
    expect(extractServerData(client({ state }))[0]).toMatchObject({
      status: 'pending',
      data: decodeJson('$@9'),
    });
  });
  it('recognizes SWR keys in App and Pages fallback objects', () => {
    expect(
      extractServerData(
        client({ value: { fallback: { '/api/posts': [{ id: 1 }], $inf$key: 2 } } }),
      ).map((entry) => [entry.source, entry.label, entry.location]),
    ).toEqual([
      ['swr', '/api/posts', 'Posts.value.fallback'],
      ['swr', '$inf$key', 'Posts.value.fallback'],
    ]);
    expect(extractServerData({ fallback: { '@"posts"': { items: [] } } })[0]).toMatchObject({
      source: 'swr',
      label: '@"posts"',
      location: 'pageProps.fallback',
    });
  });
  it.each(['__APOLLO_STATE__', 'initialApolloState'])(
    'recognizes %s and retains normalized cache',
    (key) => {
      const cache = { ROOT_QUERY: { posts: [{ __ref: 'Post:1' }] }, 'Post:1': { id: 1 } };
      expect(extractServerData({ [key]: cache })[0]).toMatchObject({
        source: 'apollo',
        label: 'posts',
        data: [{ __ref: 'Post:1' }],
        meta: { cache },
      });
    },
  );
  it.each(['initialReduxState', 'preloadedState'])('recognizes Redux %s', (key) => {
    expect(extractServerData({ [key]: { posts: { items: [{ id: 1 }] } } })[0]).toMatchObject({
      source: 'redux',
      location: `pageProps.${key}`,
      data: { posts: { items: [{ id: 1 }] } },
    });
  });
  it('recognizes urql data and error entries', () => {
    expect(
      extractServerData({ urqlState: { 42: { data: { posts: [] }, error: null } } })[0],
    ).toMatchObject({ source: 'urql', label: '42', data: { posts: [] }, meta: { error: null } });
  });
  it('resolves direct client promises but keeps plain arbitrary props generic', () => {
    expect(
      extractServerData(
        client(
          { posts: [{ id: 0 }], postsPromise: '$@2', pending: '$@9' },
          '2:{"posts":[{"id":1}]}\n',
        ),
      ),
    ).toEqual([
      expect.objectContaining({
        source: 'streamed-promise',
        location: 'Posts.postsPromise',
        status: 'resolved',
        data: { posts: [{ id: 1 }] },
      }),
      expect.objectContaining({
        source: 'streamed-promise',
        location: 'Posts.pending',
        status: 'pending',
        data: decodeJson('$@9'),
      }),
    ]);
  });
  it('keeps an unread fetch as response metadata with an explicit missing-body note', () => {
    const payload = parse(
      '0:null\n1:{"name":"Page"}\n2:J{"name":"fetch","start":10,"end":35,"env":"Server","owner":"$1","value":"$3"}\n3:{"url":"https://api.test/posts","status":200,"headers":{"content-type":"application/json"},"ok":true}\n2:J{"name":"other","start":40,"end":45,"value":{"result":1}}\n',
    );
    const entries = extractServerData(payload);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      source: 'server-io',
      label: 'fetch https://api.test/posts',
      location: 'Page',
      status: '200',
      durationMs: 25,
      meta: {
        env: 'Server',
        owner: 'Page',
        response: {
          url: 'https://api.test/posts',
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
        note: 'The response body was not read on the server (no .json()/.text() call was recorded).',
      },
    });
    expect(entries[1]).toMatchObject({ label: 'other', data: { result: 1 } });
  });
  it('merges a body read into the preceding fetch of the same owner', () => {
    const entries = extractServerData(
      parse(
        '0:null\n1:{"name":"Page"}\n2:J{"name":"fetch","owner":"$1","value":{"url":"/posts","status":200}}\n3:J{"name":"Response.json","owner":"$1","value":{"posts":[1]}}\n',
      ),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      label: 'fetch /posts',
      status: '200',
      data: { posts: [1] },
      meta: { bodyRead: 'Response.json', response: { url: '/posts', status: 200 } },
    });
  });
  it('pairs parallel fetches with body reads in FIFO order and supports text bodies', () => {
    const entries = extractServerData(
      parse(
        '0:null\n1:{"name":"Page"}\n2:J{"name":"fetch","owner":"$1","start":1,"end":5,"value":{"url":"/a","status":200}}\n3:J{"name":"fetch","owner":"$1","start":2,"end":6,"value":{"url":"/b","status":404}}\n4:J{"name":"_Response.json","owner":"$1","start":7,"end":8,"value":{"a":1}}\n5:J{"name":"_Response.text","owner":"$1","start":9,"end":10,"value":"not found"}\n',
      ),
    );
    expect(entries.map((entry) => [entry.label, entry.status, entry.data])).toEqual([
      ['fetch /a', '200', { a: 1 }],
      ['fetch /b', '404', 'not found'],
    ]);
  });
  it('keeps an unpaired body read as its own entry', () => {
    const entries = extractServerData(
      parse(
        '0:null\n1:{"name":"Loader"}\n2:J{"name":"_Response.json","owner":"$1","value":{"x":1}}\n',
      ),
    );
    expect(entries[0]).toMatchObject({ label: 'response body (Loader)', data: { x: 1 } });
  });
  it('marks absent deferred debug values as omitted by React', () => {
    const entry = extractServerData(
      parse('0:null\n1:J{"name":"json","value":{"deep":"$Y9"}}\n'),
    )[0];
    expect(entry).toMatchObject({
      meta: { omitted: 'omitted by React (object limit)' },
      data: {
        deep: { $flight: 'special', kind: 'omitted', value: 'omitted by React (object limit)' },
      },
    });
  });
  it('ignores invalid recognizer shapes and malformed I/O', () => {
    expect(
      extractServerData({
        queries: [{ queryKey: 'bad', state: {} }],
        mutations: [],
        fallback: null,
        initialApolloState: {},
        urqlState: { wrong: 4 },
      }),
    ).toEqual([]);
    expect(extractServerData(parse('0:null\n1:J{"unrelated":true}\n'))).toEqual([]);
  });
  it('bounds reference cycles, object cycles, depth and total nodes without throwing', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => extractServerData({ initialReduxState: circular })).not.toThrow();
    const payload = client(
      { promise: '$@2', preloadedState: { loop: '$3' } },
      '2:"$@2"\n3:{"again":"$3"}\n',
    );
    expect(() => extractServerData(payload)).not.toThrow();
    expect(extractServerData(payload)[0]?.status).toBe('pending');
    const large = { preloadedState: Array.from({ length: 60_000 }, (_, id) => ({ id })) };
    expect(extractServerData(large)[0]?.data).toBeDefined();
    expect(
      extractServerData(
        new Proxy(
          {},
          {
            ownKeys() {
              throw Error('bad input');
            },
          },
        ),
      ),
    ).toEqual([]);
    expect(extractServerData(buildPayload([]))).toEqual([]);
  });
});

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const documentPayload = (route: string, mode: string) => {
  const main = parseFlight(
    segmentsToBytes(extractSegmentsFromScript(fixture(`next16-${route}-${mode}.txt`))),
  );
  return mode === 'dev'
    ? buildPayload(
        mergePayloadRows(main.rows, parse(fixture(`next16-${route}-dev-debug.txt`)).rows),
      )
    : main;
};
describe('Captured Next 16 server data', () => {
  it.each(['prod', 'dev'])('extracts resolved and streamed TanStack queries in %s', (mode) => {
    const entries = extractServerData(documentPayload('query', mode)).filter(
      (entry) => entry.source === 'tanstack-query',
    );
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      label: '["posts","resolved"]',
      status: 'success',
      location: 'HydrationBoundary.state',
      data: { source: 'query-resolved', posts: [{ id: 1 }, { id: 2 }] },
    });
    expect(entries[1]).toMatchObject({
      label: '["posts","streamed"]',
      status: 'streamed',
      data: { source: 'query-streamed', posts: [{ id: 1 }, { id: 2 }] },
      meta: { streamed: true },
    });
  });
  it.each(['prod', 'dev'])('extracts SWR fallback in %s', (mode) => {
    const entries = extractServerData(documentPayload('swr', mode)).filter(
      (entry) => entry.source === 'swr',
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      label: '/api/posts?source=swr-fallback',
      data: { source: 'swr-fallback', message: 'Hello 👋 — café', posts: [{ id: 1 }, { id: 2 }] },
    });
  });
  it.each(['prod', 'dev'])('extracts a plain streamed fetch promise in %s', (mode) => {
    const entries = extractServerData(documentPayload('fetch', mode)).filter(
      (entry) => entry.source === 'streamed-promise',
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      location: 'FetchPromise.postsPromise',
      status: 'resolved',
      data: { source: 'fetch-promise', posts: [{ id: 1 }, { id: 2 }] },
    });
  });
  it('extracts Pages Router dehydration from a real data response', () => {
    const input = JSON.parse(fixture('next16-legacy-query-prod-data.json'));
    expect(extractServerData(input.props.pageProps)[0]).toMatchObject({
      source: 'tanstack-query',
      location: 'pageProps.dehydratedState',
      data: { source: 'query-legacy', posts: [{ id: 1 }, { id: 2 }] },
    });
  });
});

it('pairs reordered J rows by owner and timestamps, never with a fetch that ends later', () => {
  const entries = extractServerData(
    parse(
      '0:null\n1:{"name":"Page"}\n2:J{"name":"_Response.json","owner":"$1","start":50,"end":55,"value":{"posts":[1]}}\n3:J{"name":"fetch","owner":"$1","start":60,"end":70,"value":{"url":"/future","status":201}}\n4:J{"name":"fetch","owner":"$1","start":10,"end":20,"value":{"url":"/earlier","status":200}}\n',
    ),
  );
  expect(entries[0]).toMatchObject({
    label: 'fetch /earlier',
    status: '200',
    data: { posts: [1] },
  });
  expect(entries[1]).toMatchObject({ label: 'fetch /future', status: '201' });
  expect(entries[1]?.meta?.note).toBeDefined();
});
it('shows every real dev server fetch with its parsed JSON body, including render-only data', () => {
  const payload = documentPayload('fetch', 'dev');
  const entries = extractServerData(payload).filter((entry) => entry.source === 'server-io');
  const fetches = entries.filter((entry) => entry.label.startsWith('fetch '));
  expect(fetches).toHaveLength(3);
  expect(fetches.map((entry) => entry.status)).toEqual(['200', '200', '200']);
  expect(fetches.every((entry) => entry.meta?.bodyRead === '_Response.json')).toBe(true);
  expect(fetches.find((entry) => entry.label.includes('fetch-render-only'))).toMatchObject({
    location: 'RenderOnlyPosts',
    data: {
      source: 'fetch-render-only',
      message: 'Hello 👋 — café',
      posts: [{ id: 1 }, { id: 2 }],
    },
  });
  const props = fetches.find((entry) => entry.label.includes('fetch-props'));
  expect(props).toMatchObject({ meta: { owner: 'FetchPage' }, data: { source: 'fetch-props' } });
  expect((props?.meta?.response as { headers?: unknown })?.headers).toEqual(
    expect.arrayContaining([['content-type', 'application/json']]),
  );
  expect(entries.some((entry) => entry.label.endsWith(' → JSON'))).toBe(false);
  expect(entries.every((entry) => typeof entry.durationMs === 'number')).toBe(true);
});
