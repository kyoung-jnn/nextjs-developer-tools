/**
 * Next.js Developer Tools - Constants
 *
 * 공용 상수 정의
 * - BADGE_CONFIG: 페이로드 타입별 배지 설정
 * - PERFORMANCE: 성능 관련 상수
 */

import type { PayloadType, FilterState } from "./types";

// =============================================================================
// Badge Configuration
// =============================================================================

/**
 * 배지 설정 인터페이스
 */
export interface BadgeConfig {
  /** CSS 클래스 (DaisyUI 배지) */
  className: string;
  /** 표시 레이블 */
  label: string;
  /** 배경 색상 (hex) */
  color: string;
  /** 접근성을 위한 텍스트 설명 */
  description: string;
}

/**
 * 페이로드 타입별 배지 설정
 */
export const BADGE_CONFIG: Record<PayloadType, BadgeConfig> = {
  pageProps: {
    className: "badge-props",
    label: "Props",
    color: "#0070f3",
    description: "Page Router에서 추출된 페이지 속성 데이터",
  },
  rsc: {
    className: "badge-rsc",
    label: "RSC",
    color: "#22c55e",
    description: "App Router에서 추출된 React Server Component 페이로드",
  },
  metadata: {
    className: "badge-metadata",
    label: "Meta",
    color: "#f59e0b",
    description: "페이지 메타데이터",
  },
  buildInfo: {
    className: "badge-build",
    label: "Build",
    color: "#a855f7",
    description: "Next.js 빌드 정보",
  },
};

/**
 * 배지 클래스 조회 헬퍼
 *
 * @param type - 페이로드 타입
 * @returns DaisyUI 배지 클래스
 */
export function getBadgeClassName(type: PayloadType | string): string {
  const config = BADGE_CONFIG[type as PayloadType];
  return config?.className ?? "badge-ghost";
}

/**
 * 배지 레이블 조회 헬퍼
 *
 * @param type - 페이로드 타입
 * @returns 표시 레이블
 */
export function getBadgeLabel(type: PayloadType | string): string {
  const config = BADGE_CONFIG[type as PayloadType];
  return config?.label ?? type;
}

// =============================================================================
// Performance Constants
// =============================================================================

/**
 * 성능 관련 상수
 */
export const PERFORMANCE = {
  /** MutationObserver 디바운스 시간 (ms) */
  MUTATION_DEBOUNCE_MS: 100,

  /** 스크립트 캐시 TTL (ms) */
  SCRIPT_CACHE_TTL_MS: 5000,

  /** 최대 페이로드 크기 (5MB) */
  MAX_PAYLOAD_SIZE_BYTES: 5 * 1024 * 1024,

  /** JSON 트리 최대 깊이 */
  JSON_TREE_MAX_DEPTH: 20,

  /** 지연 로딩 임계값 (자식 요소 수) */
  LAZY_LOAD_THRESHOLD: 50,

  /** 가상 스크롤 임계값 (행 수) */
  VIRTUAL_SCROLL_THRESHOLD: 100,

  /** 행 높이 (px) */
  ROW_HEIGHT: 32,

  /** 버퍼 크기 (화면 위/아래 추가 행) */
  BUFFER_SIZE: 5,

  /** 감지 재시도 횟수 */
  DETECTION_MAX_RETRIES: 3,

  /** 감지 재시도 간격 (ms) */
  DETECTION_RETRY_DELAY_MS: 300,

  /** ping/pong 인터벌 (ms) - Service Worker 30초 타임아웃 전 */
  PING_INTERVAL_MS: 25000,

  /** 스테일 연결 정리 주기 (분) */
  CLEANUP_INTERVAL_MINUTES: 5,
} as const;

// =============================================================================
// UI Constants
// =============================================================================

/**
 * UI 관련 상수
 */
export const UI = {
  /** 복사 완료 메시지 표시 시간 (ms) */
  COPY_FEEDBACK_DURATION_MS: 1500,

  /** 토스트 메시지 표시 시간 (ms) */
  TOAST_DURATION_MS: 3000,

  /** 로딩 스켈레톤 애니메이션 속도 */
  SKELETON_ANIMATION_DURATION: "1.5s",

  /** 문자열 truncate 길이 */
  MAX_STRING_DISPLAY_LENGTH: 100,
} as const;

// =============================================================================
// Default Values
// =============================================================================

/**
 * 기본 필터 상태
 */
export const DEFAULT_FILTER_STATE: FilterState = {
  searchQuery: "",
  typeFilter: [],
  sortBy: "timestamp",
  sortOrder: "desc",
};
