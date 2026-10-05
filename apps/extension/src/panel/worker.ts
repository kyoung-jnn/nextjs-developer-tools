import type { CaptureRecord } from '../shared/types';
import { parseRecord } from './parse';

self.onmessage = (event: MessageEvent<{ id: number; record: CaptureRecord }>) => {
  try {
    self.postMessage({ id: event.data.id, parsed: parseRecord(event.data.record) });
  } catch (error) {
    self.postMessage({ id: event.data.id, error: String(error) });
  }
};
