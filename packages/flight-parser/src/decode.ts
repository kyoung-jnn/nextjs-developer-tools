/**
 * Turns parsed Flight JSON into a display-friendly value graph.
 *
 * Unlike React's client we never execute or import anything: references to
 * other rows stay as `FlightRef` markers that the UI (or `deref`) can follow
 * lazily, which also keeps cyclic graphs safe.
 */

export type RefKind =
  | 'model' // $<id>[:path]
  | 'lazy' // $L<id>
  | 'promise' // $@<id>
  | 'weak-promise' // $w<id>
  | 'server-reference' // $h<id> / $F<id>
  | 'map' // $Q<id>
  | 'set' // $W<id>
  | 'blob' // $B<id>
  | 'form-data' // $K<id>
  | 'error' // $Z<id>
  | 'iterator' // $i<id>
  | 'debug' // $P / $E / $Y (dev only)
  | 'temporary'; // $T

export interface FlightRef {
  $flight: 'ref';
  kind: RefKind;
  id: number;
  /** Property path after the id (`$1:props:children` → ['props', 'children']). */
  path: string[];
  raw: string;
}

export interface FlightElement {
  $flight: 'element';
  /** Host tag ('div'), a reference to a client module, or a symbol like `$Sreact.suspense`. */
  type: FlightValue;
  key: string | null;
  props: Record<string, FlightValue>;
  /** Dev-only owner / stack info, kept raw. */
  extra?: FlightValue[];
}

export interface FlightSpecial {
  $flight: 'special';
  /** e.g. 'undefined', 'NaN', 'Infinity', '-Infinity', '-0', 'symbol', 'date', 'bigint' */
  kind: string;
  /** Human-readable value: symbol name, ISO date, bigint digits, … */
  value?: string;
}

export type FlightValue =
  | string
  | number
  | boolean
  | null
  | FlightValue[]
  | { [key: string]: FlightValue }
  | FlightRef
  | FlightElement
  | FlightSpecial;

export function isRef(v: unknown): v is FlightRef {
  return typeof v === 'object' && v !== null && (v as FlightRef).$flight === 'ref';
}
export function isElement(v: unknown): v is FlightElement {
  return typeof v === 'object' && v !== null && (v as FlightElement).$flight === 'element';
}
export function isSpecial(v: unknown): v is FlightSpecial {
  return typeof v === 'object' && v !== null && (v as FlightSpecial).$flight === 'special';
}

const REF_PREFIXES: Record<string, RefKind> = {
  L: 'lazy',
  '@': 'promise',
  w: 'weak-promise',
  h: 'server-reference',
  F: 'server-reference',
  Q: 'map',
  W: 'set',
  B: 'blob',
  K: 'form-data',
  Z: 'error',
  i: 'iterator',
  P: 'debug',
  E: 'debug',
  Y: 'debug',
};

function parseRef(kind: RefKind, body: string, raw: string): FlightRef | null {
  const [idPart, ...path] = body.split(':');
  if (!idPart || !/^[0-9a-f]+$/i.test(idPart)) return null;
  return { $flight: 'ref', kind, id: Number.parseInt(idPart, 16), path, raw };
}

export function decodeString(value: string): FlightValue {
  if (value[0] !== '$' || value.length < 2) return value;
  const marker = value[1] as string;
  const rest = value.slice(2);
  switch (marker) {
    case '$':
      return value.slice(1);
    case 'S':
      return { $flight: 'special', kind: 'symbol', value: rest };
    case 'u':
      return { $flight: 'special', kind: 'undefined' };
    case 'N':
      if (value === '$NaN') return { $flight: 'special', kind: 'NaN' };
      break;
    case 'I':
      if (value === '$I' || value === '$Infinity') return { $flight: 'special', kind: 'Infinity' };
      break;
    case '-':
      if (value === '$-0') return { $flight: 'special', kind: '-0' };
      if (value === '$-Infinity') return { $flight: 'special', kind: '-Infinity' };
      break;
    case 'D':
      return { $flight: 'special', kind: 'date', value: rest };
    case 'n':
      return { $flight: 'special', kind: 'bigint', value: rest };
    case 'T':
      return { $flight: 'ref', kind: 'temporary', id: -1, path: [], raw: value };
  }
  if (value === '$undefined') return { $flight: 'special', kind: 'undefined' };
  if (['$P', '$E', '$Y'].includes(value))
    return { $flight: 'ref', kind: 'debug', id: -1, path: [], raw: value };
  const prefixed = REF_PREFIXES[marker];
  if (prefixed) {
    const ref = parseRef(prefixed, rest, value);
    if (ref) return ref;
  }
  const ref = parseRef('model', value.slice(1), value);
  if (ref) return ref;
  return value;
}

export function decodeJson(json: unknown): FlightValue {
  if (typeof json === 'string') return decodeString(json);
  if (json === null || typeof json !== 'object') return json as FlightValue;
  if (Array.isArray(json)) {
    if (json[0] === '$' && json.length >= 4) {
      const props = decodeJson(json[3]);
      return {
        $flight: 'element',
        type: decodeJson(json[1]),
        key: typeof json[2] === 'string' ? json[2] : null,
        props:
          props && typeof props === 'object' && !Array.isArray(props) && !('$flight' in props)
            ? (props as Record<string, FlightValue>)
            : { value: props },
        extra: json.length > 4 ? json.slice(4).map(decodeJson) : undefined,
      };
    }
    return json.map(decodeJson);
  }
  return Object.fromEntries(
    Object.entries(json as Record<string, unknown>).map(([key, value]) => [key, decodeJson(value)]),
  );
}
