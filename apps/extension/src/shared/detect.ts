import type { Detection } from './types';
export interface DetectInput {
  windowNext?: { version?: unknown; appDir?: unknown } | null;
  hasNextData: boolean;
  nextDataBuildId?: string;
  hasNextF: boolean;
  hasNextStatic: boolean;
  hasHmr?: boolean;
  hasDevOverlay?: boolean;
  final?: boolean;
}
export function detectNext(input: DetectInput): Detection {
  const signals: string[] = [];
  if (input.windowNext?.appDir === true) signals.push('window.next.appDir');
  if (input.hasNextData) signals.push('__NEXT_DATA__');
  if (input.hasNextF) signals.push('__next_f');
  if (input.windowNext) signals.push('window.next');
  if (input.hasNextStatic) signals.push('/_next/static');
  const router =
    input.windowNext?.appDir === true
      ? 'app'
      : input.hasNextData
        ? 'pages'
        : input.hasNextF
          ? 'app'
          : signals.length
            ? 'unknown'
            : null;
  const development =
    input.nextDataBuildId === 'development' || input.hasHmr || input.hasDevOverlay;
  if (input.nextDataBuildId === 'development') signals.push('dev:buildId');
  if (input.hasHmr) signals.push('dev:hmr');
  if (input.hasDevOverlay) signals.push('dev:overlay');
  const mode =
    router !== null
      ? development
        ? 'development'
        : input.final
          ? 'production'
          : undefined
      : undefined;
  return {
    ...(mode ? { mode } : {}),
    isNext: router !== null,
    router,
    signals,
    ...(typeof input.windowNext?.version === 'string' ? { version: input.windowNext.version } : {}),
    ...(input.nextDataBuildId !== undefined ? { buildId: input.nextDataBuildId } : {}),
  };
}
