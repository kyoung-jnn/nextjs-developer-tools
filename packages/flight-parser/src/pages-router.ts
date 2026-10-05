export interface PagesSummary {
  page?: string;
  buildId?: string;
  query?: unknown;
  pageProps?: unknown;
  dataFetching: ('getServerSideProps' | 'getStaticProps' | 'getInitialProps')[];
  isFallback?: boolean;
  nextExport?: boolean;
  autoExport?: boolean;
  raw: unknown;
}
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function summarize(json: unknown, document: boolean): PagesSummary {
  const data = record(json);
  const result: PagesSummary = { raw: json, dataFetching: [] };
  if (data.gssp === true || data.__N_SSP === true) result.dataFetching.push('getServerSideProps');
  if (data.gsp === true || data.__N_SSG === true) result.dataFetching.push('getStaticProps');
  if (data.gip === true) result.dataFetching.push('getInitialProps');
  if (typeof data.page === 'string') result.page = data.page;
  if (typeof data.buildId === 'string') result.buildId = data.buildId;
  if ('query' in data) result.query = data.query;
  const props = document ? record(data.props) : data;
  if ('pageProps' in props) result.pageProps = props.pageProps;
  for (const key of ['isFallback', 'nextExport', 'autoExport'] as const)
    if (typeof data[key] === 'boolean') result[key] = data[key];
  return result;
}
export function summarizePagesDocument(json: unknown): PagesSummary {
  return summarize(json, true);
}
export function summarizePagesData(json: unknown): PagesSummary {
  return summarize(json, false);
}
