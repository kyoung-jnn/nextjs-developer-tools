/**
 * Next.js Developer Tools - Badge Manager
 * 확장 프로그램 아이콘 배지 업데이트 로직
 */

import type { RouterType } from "@/shared/types";

// =============================================================================
// Badge Configuration
// =============================================================================

/** 라우터 타입별 배지 설정 */
const BADGE_CONFIG: Record<RouterType, { text: string; color: string }> = {
  app: {
    text: "App",
    color: "#0070f3", // Next.js 파란색
  },
  page: {
    text: "Page",
    color: "#7928ca", // 보라색
  },
  none: {
    text: "",
    color: "#666666", // 회색
  },
};

/** 아이콘 경로 설정 */
const ICON_PATHS = {
  color: {
    16: "/icon-16.png",
    48: "/icon-48.png",
    128: "/icon-128.png",
  },
  gray: {
    16: "/icon-gray-16.png",
    48: "/icon-gray-48.png",
    128: "/icon-gray-128.png",
  },
};

// =============================================================================
// Badge Update Functions
// =============================================================================

/**
 * 특정 탭의 배지 텍스트 업데이트
 */
export const updateBadgeText = async (
  tabId: number,
  text: string
): Promise<void> => {
  try {
    await chrome.action.setBadgeText({
      tabId,
      text,
    });
  } catch (error) {
    // 탭이 닫혔거나 유효하지 않을 수 있음
    console.warn(
      `[Next.js DevTools] Failed to update badge text for tab ${tabId}:`,
      error
    );
  }
};

/**
 * 특정 탭의 배지 색상 업데이트
 */
export const updateBadgeColor = async (
  tabId: number,
  color: string
): Promise<void> => {
  try {
    // 배경 색상 설정
    await chrome.action.setBadgeBackgroundColor({
      tabId,
      color,
    });

    // 텍스트 색상 (가독성을 위해 흰색)
    await chrome.action.setBadgeTextColor({
      tabId,
      color: "#ffffff",
    });
  } catch (error) {
    console.warn(
      `[Next.js DevTools] Failed to update badge color for tab ${tabId}:`,
      error
    );
  }
};

/**
 * 라우터 타입에 따른 배지 스타일 적용
 * App Router: 파란색 "App"
 * Page Router: 보라색 "Page"
 * None: 빈 배지
 */
export const updateBadge = async (
  tabId: number,
  routerType: RouterType
): Promise<void> => {
  const config = BADGE_CONFIG[routerType];
  const isNextJs = routerType !== "none";

  try {
    // 배지 텍스트 설정
    await chrome.action.setBadgeText({
      tabId,
      text: config.text,
    });

    // 배지 배경 색상 설정
    await chrome.action.setBadgeBackgroundColor({
      tabId,
      color: config.color,
    });

    // 배지 텍스트 색상 (가독성을 위해 흰색)
    await chrome.action.setBadgeTextColor({
      tabId,
      color: "#ffffff",
    });

    // 아이콘 툴팁 업데이트
    const title = getIconTitle(routerType);
    await chrome.action.setTitle({
      tabId,
      title,
    });

    // 아이콘 업데이트 (Next.js: 컬러, 그 외: 흑백)
    await updateIcon(tabId, isNextJs);

    console.log(
      `[Next.js DevTools] Badge updated: ${routerType} for tab ${tabId}`
    );
  } catch (error) {
    console.warn(
      `[Next.js DevTools] Failed to update badge for tab ${tabId}:`,
      error
    );
  }
};

/**
 * 아이콘 업데이트 (Next.js: 검은 배경 / 그 외: 회색 배경)
 */
const updateIcon = async (tabId: number, isNextJs: boolean): Promise<void> => {
  try {
    await chrome.action.setIcon({
      tabId,
      path: isNextJs ? ICON_PATHS.color : ICON_PATHS.gray,
    });
  } catch (error) {
    console.warn(
      `[Next.js DevTools] Failed to update icon for tab ${tabId}:`,
      error
    );
  }
};

/**
 * 특정 탭의 배지 초기화
 */
export const clearBadge = async (tabId: number): Promise<void> => {
  try {
    await chrome.action.setBadgeText({
      tabId,
      text: "",
    });

    await chrome.action.setTitle({
      tabId,
      title: "Next.js Developer Tools",
    });

    // 흑백 아이콘으로 변경
    await updateIcon(tabId, false);
  } catch (error) {
    console.warn(
      `[Next.js DevTools] Failed to clear badge for tab ${tabId}:`,
      error
    );
  }
};

/**
 * 현재 활성 탭의 배지 업데이트
 */
export const updateBadgeForActiveTab = async (
  routerType: RouterType
): Promise<void> => {
  try {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (activeTab?.id) {
      await updateBadge(activeTab.id, routerType);
    }
  } catch (error) {
    console.warn(
      "[Next.js DevTools] Failed to update badge for active tab:",
      error
    );
  }
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * 라우터 타입에 따른 아이콘 툴팁 텍스트
 */
const getIconTitle = (routerType: RouterType): string => {
  switch (routerType) {
    case "app":
      return "Next.js App Router detected";
    case "page":
      return "Next.js Page Router detected";
    case "none":
    default:
      return "Next.js Developer Tools";
  }
};

/**
 * 배지 설정 조회
 */
export const getBadgeConfig = (routerType: RouterType) => {
  return BADGE_CONFIG[routerType];
};
