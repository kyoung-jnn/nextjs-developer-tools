/**
 * SSR Payload extraction logic
 * Extracts __NEXT_DATA__ (Page Router) and RSC payload (App Router)
 */

import type { PayloadType } from "../shared/types";

export interface ExtractionResult {
  payloadType: PayloadType;
  rawData: string;
  success: boolean;
  error?: string;
}

/**
 * Extract SSR payload from the current page
 * Attempts both Page Router and App Router extraction
 */
export const extractPayload = (): ExtractionResult => {
  // Try Page Router extraction first
  const pageRouterResult = extractPageRouterPayload();
  if (pageRouterResult.success) {
    return pageRouterResult;
  }

  // Try App Router extraction
  const appRouterResult = extractAppRouterPayload();
  if (appRouterResult.success) {
    return appRouterResult;
  }

  // No payload found
  return {
    payloadType: "pageProps",
    rawData: "",
    success: false,
    error: "No SSR payload found on this page",
  };
};

/**
 * Extract Page Router __NEXT_DATA__ payload
 * Parses the JSON content from the script tag
 */
export const extractPageRouterPayload = (): ExtractionResult => {
  const nextDataElement = document.querySelector("#__NEXT_DATA__");

  if (!nextDataElement) {
    return {
      payloadType: "pageProps",
      rawData: "",
      success: false,
      error: "__NEXT_DATA__ element not found",
    };
  }

  const textContent = nextDataElement.textContent;

  if (!textContent) {
    return {
      payloadType: "pageProps",
      rawData: "",
      success: false,
      error: "__NEXT_DATA__ element is empty",
    };
  }

  // Validate JSON
  try {
    JSON.parse(textContent);
  } catch {
    return {
      payloadType: "pageProps",
      rawData: textContent,
      success: false,
      error: "Failed to parse __NEXT_DATA__ JSON",
    };
  }

  return {
    payloadType: "pageProps",
    rawData: textContent,
    success: true,
  };
};

/**
 * Extract App Router RSC payload
 * Collects chunks from self.__next_f array and script tags
 */
export const extractAppRouterPayload = (): ExtractionResult => {
  const chunks: string[] = [];

  // Method 1: Check self.__next_f array
  const windowWithNext = window as Window & {
    __next_f?: unknown[];
    self?: {
      __next_f?: unknown[];
    };
  };

  const nextFArray = windowWithNext.__next_f || windowWithNext.self?.__next_f;

  if (Array.isArray(nextFArray) && nextFArray.length > 0) {
    for (const item of nextFArray) {
      if (Array.isArray(item) && item.length >= 2) {
        // RSC format: [type, data]
        const data = item[1];
        if (typeof data === "string") {
          chunks.push(data);
        }
      }
    }
  }

  // Method 2: Extract from inline script tags with RSC data
  const scriptTags = document.querySelectorAll("script");
  for (const script of scriptTags) {
    const content = script.textContent || "";

    // Look for self.__next_f.push patterns
    const pushMatches = content.matchAll(
      /self\.__next_f\.push\(\[([\d]+),\s*["'](.+?)["']\]\)/g
    );
    for (const match of pushMatches) {
      if (match[2]) {
        try {
          // Decode escaped strings
          const decoded = JSON.parse(`"${match[2]}"`);
          chunks.push(decoded);
        } catch {
          chunks.push(match[2]);
        }
      }
    }
  }

  if (chunks.length === 0) {
    return {
      payloadType: "rsc",
      rawData: "",
      success: false,
      error: "No RSC payload found",
    };
  }

  // Join chunks with newlines for storage
  const rawData = chunks.join("\n");

  return {
    payloadType: "rsc",
    rawData,
    success: true,
  };
};

/**
 * Extract payload with retry mechanism
 * Useful for pages where content loads asynchronously
 */
export const extractPayloadWithRetry = async (
  maxAttempts = 3,
  delayMs = 500
): Promise<ExtractionResult> => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = extractPayload();

    if (result.success) {
      return result;
    }

    // If this isn't the last attempt, wait and retry
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // All attempts failed
  return {
    payloadType: "pageProps",
    rawData: "",
    success: false,
    error: "Failed to extract payload after multiple attempts",
  };
};

/**
 * Parse extracted RSC chunk data into structured format
 * RSC format varies by Next.js version, this handles common patterns
 */
export const parseRSCChunks = (
  rawData: string
): Array<{
  index: number;
  type: string;
  data: unknown;
}> => {
  const lines = rawData.split("\n");
  const parsed: Array<{ index: number; type: string; data: unknown }> = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    // Try to parse RSC chunk format: "index:data"
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const indexStr = line.substring(0, colonIndex);
      const dataStr = line.substring(colonIndex + 1);

      const index = parseInt(indexStr, 10);
      if (!isNaN(index)) {
        try {
          const data = JSON.parse(dataStr);
          parsed.push({
            index,
            type: determineChunkType(data),
            data,
          });
        } catch {
          // Not valid JSON, store as string
          parsed.push({
            index,
            type: "text",
            data: dataStr,
          });
        }
      }
    }
  }

  return parsed;
};

/**
 * Determine the type of RSC chunk based on its content
 */
const determineChunkType = (data: unknown): string => {
  if (typeof data === "string") {
    if (data.startsWith("$")) {
      return "reference";
    }
    return "text";
  }

  if (Array.isArray(data)) {
    const firstItem = data[0];
    if (typeof firstItem === "string" && firstItem.startsWith("$")) {
      return "component";
    }
    return "array";
  }

  if (typeof data === "object" && data !== null) {
    if ("children" in data) {
      return "element";
    }
    return "object";
  }

  return "unknown";
};
