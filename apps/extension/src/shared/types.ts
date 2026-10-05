export type RouterKind = 'app' | 'pages' | 'unknown';
export interface Detection {
  isNext: boolean;
  router: RouterKind | null;
  version?: string;
  buildId?: string;
  mode?: 'development' | 'production';
  signals: string[];
}
export type CaptureKind =
  | 'document'
  | 'navigation'
  | 'prefetch'
  | 'action'
  | 'rsc'
  | 'pages-document'
  | 'pages-data';
export interface CaptureRecord {
  id: string;
  kind: CaptureKind;
  url: string;
  method: string;
  status?: number;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  startTime: number;
  endTime?: number;
  requestId?: string;
  debugChunks: Uint8Array[];
  debugDone: boolean;
  chunks: Uint8Array[];
  done: boolean;
  error?: string;
  formState?: unknown;
}
export type WireRecord = Omit<CaptureRecord, 'chunks' | 'debugChunks'> & {
  chunks: string[];
  debugChunks: string[];
};
