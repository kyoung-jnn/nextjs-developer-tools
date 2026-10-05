/**
 * Byte-level tokenizer for the React Flight (RSC) wire format.
 *
 * Mirrors the row state machine in React's `ReactFlightClient.processBinaryChunk`:
 *
 *   <id hex>:<tag?><payload>\n            newline-terminated rows
 *   <id hex>:<tag><length hex>,<bytes>    length-prefixed rows (T, typed arrays, b)
 *
 * Length prefixes count UTF-8 *bytes*, so this must operate on `Uint8Array`,
 * never on JS strings (which would break on multi-byte characters).
 */

export interface FlightRow {
  /** Row id (parsed from hex). */
  id: number;
  /** Row tag character, or '' for a plain JSON model row. */
  tag: string;
  /** Raw row payload bytes (without id, tag, length prefix or trailing newline). */
  bytes: Uint8Array;
  /** Byte offset of the row start within the whole stream. */
  offset: number;
}

const ROW_ID = 0;
const ROW_TAG = 1;
const ROW_LENGTH = 2;
const ROW_CHUNK_BY_NEWLINE = 3;
const ROW_CHUNK_BY_LENGTH = 4;

const COLON = 58;
const COMMA = 44;
const NEWLINE = 10;

/** Tags whose payload is length-prefixed (`<len hex>,`). */
const LENGTH_TAGS = new Set(
  ['T', 'A', 'O', 'o', 'b', 'U', 'S', 's', 'L', 'l', 'G', 'g', 'M', 'm', 'V'].map((c) =>
    c.charCodeAt(0),
  ),
);

function hexDigit(byte: number): number {
  return byte >= 97 ? byte - 87 : byte >= 65 ? byte - 55 : byte - 48;
}

function isNewlineTag(byte: number): boolean {
  // "A"-"Z", "#", "r", "x"
  return (byte > 64 && byte < 91) || byte === 35 || byte === 114 || byte === 120;
}

function concat(parts: Uint8Array[]): Uint8Array {
  if (parts.length === 1 && parts[0]) return parts[0];
  let total = 0;
  for (const p of parts) total += p.byteLength;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.byteLength;
  }
  return out;
}

/** Incremental tokenizer: feed chunks as they arrive, collect completed rows. */
export class FlightTokenizer {
  private state = ROW_ID;
  private rowId = 0;
  private rowTag = 0;
  private rowLength = 0;
  private rowOffset = 0;
  private buffer: Uint8Array[] = [];
  private consumed = 0;

  push(chunk: Uint8Array): FlightRow[] {
    const rows: FlightRow[] = [];
    let i = 0;
    const len = chunk.byteLength;
    while (i < len) {
      let lastIdx = -1;
      switch (this.state) {
        case ROW_ID: {
          const byte = chunk[i++] as number;
          if (byte === COLON) {
            this.state = ROW_TAG;
          } else if (byte === NEWLINE && this.rowId === 0) {
            // Tolerate stray blank lines between rows.
            this.rowOffset = this.consumed + i;
          } else {
            this.rowId = this.rowId * 16 + hexDigit(byte);
          }
          continue;
        }
        case ROW_TAG: {
          const byte = chunk[i] as number;
          if (LENGTH_TAGS.has(byte)) {
            this.rowTag = byte;
            this.state = ROW_LENGTH;
            i++;
          } else if (isNewlineTag(byte)) {
            this.rowTag = byte;
            this.state = ROW_CHUNK_BY_NEWLINE;
            i++;
          } else {
            // Not a tag: part of a JSON model row.
            this.rowTag = 0;
            this.state = ROW_CHUNK_BY_NEWLINE;
          }
          continue;
        }
        case ROW_LENGTH: {
          const byte = chunk[i++] as number;
          if (byte === COMMA) {
            this.state = ROW_CHUNK_BY_LENGTH;
            if (this.rowLength === 0) {
              rows.push({
                id: this.rowId,
                tag: String.fromCharCode(this.rowTag),
                bytes: new Uint8Array(),
                offset: this.rowOffset,
              });
              this.state = ROW_ID;
              this.rowId = 0;
              this.rowTag = 0;
              this.rowOffset = this.consumed + i;
            }
          } else {
            this.rowLength = this.rowLength * 16 + hexDigit(byte);
          }
          continue;
        }
        case ROW_CHUNK_BY_NEWLINE: {
          lastIdx = chunk.indexOf(NEWLINE, i);
          break;
        }
        case ROW_CHUNK_BY_LENGTH: {
          lastIdx = i + this.rowLength;
          if (lastIdx > len) lastIdx = -1;
          break;
        }
      }

      if (lastIdx > -1) {
        this.buffer.push(chunk.subarray(i, lastIdx));
        rows.push({
          id: this.rowId,
          tag: this.rowTag === 0 ? '' : String.fromCharCode(this.rowTag),
          bytes: concat(this.buffer).slice(),
          offset: this.rowOffset,
        });
        i = lastIdx;
        if (this.state === ROW_CHUNK_BY_NEWLINE) i++;
        this.state = ROW_ID;
        this.rowTag = 0;
        this.rowId = 0;
        this.rowLength = 0;
        this.buffer = [];
        this.rowOffset = this.consumed + i;
      } else {
        const rest = chunk.subarray(i);
        this.buffer.push(rest.slice());
        this.rowLength -= rest.byteLength;
        break;
      }
    }
    this.consumed += len;
    return rows;
  }

  /**
   * Returns a trailing row that was not newline-terminated (e.g. a truncated
   * stream), so nothing silently disappears from the UI.
   */
  flush(): FlightRow[] {
    if (this.state === ROW_ID || this.buffer.length === 0) return [];
    const row: FlightRow = {
      id: this.rowId,
      tag: this.rowTag === 0 ? '' : String.fromCharCode(this.rowTag),
      bytes: concat(this.buffer),
      offset: this.rowOffset,
    };
    this.state = ROW_ID;
    this.rowId = 0;
    this.rowTag = 0;
    this.rowLength = 0;
    this.rowOffset = this.consumed;
    this.buffer = [];
    return [row];
  }
}

export function tokenize(bytes: Uint8Array): FlightRow[] {
  const t = new FlightTokenizer();
  return [...t.push(bytes), ...t.flush()];
}
