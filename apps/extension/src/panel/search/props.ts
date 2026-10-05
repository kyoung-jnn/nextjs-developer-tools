import { deref } from '@nextjs-devtools/flight-parser';
import type { ParsedRecord } from '../parse';
import { groupClients } from '../presentation';
import { searchValue } from './matchers';

/** Prefix only visible fields; structural section names are not searchable nodes. */
export function searchProps(
  parsed: ParsedRecord | null,
  query: string,
  caseSensitive: boolean,
  action: boolean,
  formatDate?: (value: string) => string,
) {
  const paths: string[][] = [];
  let remaining = 200000;
  let limited = false;
  const add = (value: unknown, prefix: string[]) => {
    if (remaining <= 0) {
      limited = true;
      return;
    }
    const result = searchValue(value, query, { caseSensitive, budget: remaining, formatDate });
    // Account for visited nodes even when they do not match.
    remaining -= result.visited;
    limited ||= result.limited;
    for (const path of result.paths) paths.push([...prefix, ...path]);
  };
  if (!parsed || !query) return { paths, limited };
  parsed.serverData.forEach((entry, index) => {
    for (const field of ['label', 'location', 'status', 'data'] as const) {
      if (entry[field] !== undefined) add(entry[field], ['server', String(index), field]);
    }
  });
  if (parsed.type === 'pages') add(parsed.pages.pageProps, ['pageProps']);
  else {
    if (action)
      add(deref(parsed.payload, parsed.next.fields.find((field) => field.key === 'a')?.value), [
        'action',
      ]);
    groupClients(parsed.clients).forEach((group) => {
      add(group.component, ['clients', group.moduleId, 'component']);
      add(group.moduleId, ['clients', group.moduleId, 'moduleId']);
      group.instances.forEach((client, index) => {
        add(client.props, ['clients', group.moduleId, 'instances', String(index)]);
      });
    });
  }
  return { paths, limited };
}
