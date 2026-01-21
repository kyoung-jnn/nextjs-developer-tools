/**
 * Next.js Developer Tools - Payload Parser
 * JSON 파싱, 크기 계산, 데이터 변환 유틸리티
 */

import type { PayloadEntry, PayloadType, FilterState } from "./types";
import { generateUUID } from "./types";

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * 문자열의 바이트 크기 계산
 */
export const calculateSize = (data: string): number => new Blob([data]).size;

/**
 * 바이트를 읽기 좋은 형식으로 변환
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
};

/**
 * 안전한 JSON 파싱
 */
export const safeParseJSON = <T = unknown>(jsonString: string): T | null => {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return null;
  }
};

// =============================================================================
// Page Router Parsing
// =============================================================================

/**
 * __NEXT_DATA__ 스크립트에서 페이로드 추출
 */
export const extractNextData = (): string | null => {
  const script = document.querySelector("#__NEXT_DATA__");
  return script?.textContent ?? null;
};

/**
 * Page Router 페이로드 파싱
 */
export const parsePageRouterPayload = (
  rawData: string
): PayloadEntry | null => {
  const parsed = safeParseJSON<Record<string, unknown>>(rawData);
  if (!parsed) return null;

  const page = (parsed.page as string) || "/";
  const props = parsed.props as Record<string, unknown> | undefined;
  const pageProps = props?.pageProps as Record<string, unknown> | undefined;

  return {
    id: generateUUID(),
    name: page,
    type: "pageProps",
    size: calculateSize(rawData),
    timestamp: Date.now(),
    data: pageProps ?? parsed,
    raw: rawData,
  };
};

// =============================================================================
// App Router Parsing
// =============================================================================

/**
 * RSC 청크 패턴 정규식
 * 형식: "index:data" (예: "0:...", "1:...")
 */
const RSC_CHUNK_PATTERN = /^(\d+):(.+)$/;

/**
 * self.__next_f 배열에서 RSC 페이로드 추출
 */
export const extractRSCPayload = (): string[] => {
  const chunks: string[] = [];

  // self.__next_f 배열 확인
  const nextF = (
    globalThis as unknown as { __next_f?: Array<[number, string]> }
  ).__next_f;

  if (Array.isArray(nextF)) {
    for (const item of nextF) {
      if (Array.isArray(item) && item[0] === 1 && typeof item[1] === "string") {
        chunks.push(item[1]);
      }
    }
  }

  return chunks;
};

/**
 * App Router RSC 페이로드 파싱
 */
export const parseAppRouterPayload = (chunks: string[]): PayloadEntry[] => {
  const entries: PayloadEntry[] = [];

  for (const chunk of chunks) {
    const match = chunk.match(RSC_CHUNK_PATTERN);
    if (match) {
      const [, index, data] = match;
      const parsed = safeParseJSON(data);

      entries.push({
        id: generateUUID(),
        name: `RSC Chunk #${index}`,
        type: "rsc",
        size: calculateSize(chunk),
        timestamp: Date.now(),
        data: parsed ?? data,
        raw: chunk,
      });
    } else {
      // 패턴이 맞지 않는 경우 전체 청크를 저장
      entries.push({
        id: generateUUID(),
        name: `RSC Data`,
        type: "rsc",
        size: calculateSize(chunk),
        timestamp: Date.now(),
        data: chunk,
        raw: chunk,
      });
    }
  }

  return entries;
};

// =============================================================================
// Metadata & Build Info Parsing
// =============================================================================

/**
 * 빌드 정보 추출 (Page Router)
 */
export const extractBuildInfo = (rawData: string): PayloadEntry | null => {
  const parsed = safeParseJSON<Record<string, unknown>>(rawData);
  if (!parsed) return null;

  const buildId = parsed.buildId as string | undefined;
  const assetPrefix = parsed.assetPrefix as string | undefined;
  const nextExport = parsed.nextExport as boolean | undefined;
  const autoExport = parsed.autoExport as boolean | undefined;

  if (!buildId) return null;

  const buildInfo = {
    buildId,
    assetPrefix: assetPrefix ?? "",
    nextExport: nextExport ?? false,
    autoExport: autoExport ?? false,
  };

  return {
    id: generateUUID(),
    name: "Build Info",
    type: "buildInfo",
    size: calculateSize(JSON.stringify(buildInfo)),
    timestamp: Date.now(),
    data: buildInfo,
    raw: JSON.stringify(buildInfo),
  };
};

// =============================================================================
// Filtering & Sorting
// =============================================================================

/**
 * 필터 상태에 따라 페이로드 항목 필터링
 */
export const filterPayloads = (
  entries: PayloadEntry[],
  filter: FilterState
): PayloadEntry[] => {
  let filtered = [...entries];

  // 타입 필터 적용
  if (filter.typeFilter.length > 0) {
    filtered = filtered.filter((e) => filter.typeFilter.includes(e.type));
  }

  // 검색어 필터 적용
  if (filter.searchQuery.trim()) {
    const query = filter.searchQuery.toLowerCase().trim();
    filtered = filtered.filter((e) => {
      // 이름에서 검색
      if (e.name.toLowerCase().includes(query)) return true;
      // 데이터에서 검색 (JSON 문자열화)
      const dataStr = JSON.stringify(e.data).toLowerCase();
      return dataStr.includes(query);
    });
  }

  return filtered;
};

/**
 * 정렬 조건에 따라 페이로드 항목 정렬
 */
export const sortPayloads = (
  entries: PayloadEntry[],
  sortBy: "name" | "size" | "timestamp",
  sortOrder: "asc" | "desc"
): PayloadEntry[] => {
  const sorted = [...entries];
  const multiplier = sortOrder === "asc" ? 1 : -1;

  sorted.sort((a, b) => {
    switch (sortBy) {
      case "name":
        return multiplier * a.name.localeCompare(b.name);
      case "size":
        return multiplier * (a.size - b.size);
      case "timestamp":
        return multiplier * (a.timestamp - b.timestamp);
      default:
        return 0;
    }
  });

  return sorted;
};

/**
 * 필터링 및 정렬 적용
 */
export const applyFilterAndSort = (
  entries: PayloadEntry[],
  filter: FilterState
): PayloadEntry[] => {
  const filtered = filterPayloads(entries, filter);
  return sortPayloads(filtered, filter.sortBy, filter.sortOrder);
};

// =============================================================================
// Type Helpers
// =============================================================================

/**
 * PayloadType에 따른 표시 이름
 */
export const getPayloadTypeLabel = (type: PayloadType): string => {
  switch (type) {
    case "pageProps":
      return "Page Props";
    case "rsc":
      return "RSC";
    case "metadata":
      return "Metadata";
    case "buildInfo":
      return "Build Info";
    default:
      return type;
  }
};

/**
 * PayloadType에 따른 배지 색상 클래스
 */
export const getPayloadTypeBadgeClass = (type: PayloadType): string => {
  switch (type) {
    case "pageProps":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "rsc":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    case "metadata":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "buildInfo":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    default:
      return "bg-gray-100 text-gray-800";
  }
};
