/**
 * Next.js Developer Tools - Formatters
 *
 * 표시용 포맷팅 함수 모음
 * - formatTimestamp: 타임스탬프 포맷팅
 * - formatBytes: 바이트 크기 포맷팅
 */

// =============================================================================
// Timestamp Formatting
// =============================================================================

/**
 * 타임스탬프 포맷 옵션
 */
export type TimestampFormat = "full" | "time" | "relative" | "date";

/**
 * Unix 타임스탬프를 읽기 쉬운 문자열로 포맷
 *
 * @param timestamp - Unix 타임스탬프 (밀리초)
 * @param format - 출력 포맷
 *   - 'full': 전체 날짜 및 시간 (예: "2025-01-21 14:30:25")
 *   - 'time': 시간만 (예: "14:30:25")
 *   - 'relative': 상대 시간 (예: "2분 전")
 *   - 'date': 날짜만 (예: "2025-01-21")
 * @returns 포맷된 타임스탬프 문자열
 *
 * @example
 * formatTimestamp(Date.now(), 'time')     // Returns: "14:30:25"
 * formatTimestamp(Date.now(), 'relative') // Returns: "방금 전"
 */
export function formatTimestamp(
  timestamp: number,
  format: TimestampFormat = "time"
): string {
  const date = new Date(timestamp);

  switch (format) {
    case "full":
      return date.toLocaleString();

    case "time":
      return date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

    case "date":
      return date.toLocaleDateString();

    case "relative":
      return formatRelativeTime(timestamp);

    default:
      return date.toLocaleString();
  }
}

/**
 * 상대 시간 포맷 (예: "2분 전", "1시간 전")
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 5) {
    return "방금 전";
  }
  if (seconds < 60) {
    return `${seconds}초 전`;
  }
  if (minutes < 60) {
    return `${minutes}분 전`;
  }
  if (hours < 24) {
    return `${hours}시간 전`;
  }
  if (days < 7) {
    return `${days}일 전`;
  }

  return formatTimestamp(timestamp, "date");
}

// =============================================================================
// Bytes Formatting
// =============================================================================

/** 바이트 단위 */
const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** KB 기준값 */
const KB = 1024;

/**
 * 바이트를 읽기 쉬운 형식으로 포맷
 *
 * @param bytes - 바이트 수
 * @param decimals - 소수점 자릿수 (기본값: 1)
 * @returns 포맷된 크기 문자열 (예: "1.5 KB")
 *
 * @example
 * formatBytes(1024)       // Returns: "1.0 KB"
 * formatBytes(1536)       // Returns: "1.5 KB"
 * formatBytes(1048576)    // Returns: "1.0 MB"
 * formatBytes(0)          // Returns: "0 B"
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  if (bytes < 0) return "-" + formatBytes(-bytes, decimals);

  const unitIndex = Math.floor(Math.log(bytes) / Math.log(KB));
  const clampedIndex = Math.min(unitIndex, BYTE_UNITS.length - 1);
  const value = bytes / Math.pow(KB, clampedIndex);

  return `${value.toFixed(decimals)} ${BYTE_UNITS[clampedIndex]}`;
}

/**
 * 포맷된 바이트 문자열을 바이트 수로 변환
 *
 * @param formatted - 포맷된 크기 문자열 (예: "1.5 KB")
 * @returns 바이트 수 또는 파싱 실패 시 null
 *
 * @example
 * parseBytes("1.5 KB")  // Returns: 1536
 * parseBytes("1 MB")    // Returns: 1048576
 * parseBytes("invalid") // Returns: null
 */
export function parseBytes(formatted: string): number | null {
  const match = formatted.match(/^([\d.]+)\s*([A-Z]+)$/i);
  if (!match) return null;

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  const unitIndex = BYTE_UNITS.indexOf(unit as (typeof BYTE_UNITS)[number]);
  if (unitIndex === -1 || isNaN(value)) return null;

  return Math.round(value * Math.pow(KB, unitIndex));
}
