import type { BackgroundToPanelMessage } from '../shared/messages';
import type { Detection, WireRecord } from '../shared/types';
export interface SourceSnapshot {
  url: string;
  detection: Detection | null;
  records: WireRecord[];
}
export interface DataSource {
  snapshot(): SourceSnapshot;
  subscribe(listener: (message: BackgroundToPanelMessage) => void): () => void;
}
