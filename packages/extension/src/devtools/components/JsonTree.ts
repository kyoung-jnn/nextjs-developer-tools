/**
 * JsonTree component
 * Renders JSON data as an expandable/collapsible tree view
 *
 * Performance optimizations:
 * - IntersectionObserver-based lazy rendering for visible nodes
 * - Depth limit (MAX_DEPTH) to prevent infinite nesting
 * - Lazy load threshold for large collections (50+ children)
 */

import { escapeHtml } from "@/shared/utils";
import { PERFORMANCE, UI } from "@/shared/constants";

/** Lazy loaded items state per path */
interface LazyLoadState {
  loadedCount: number;
  totalCount: number;
}

export class JsonTree {
  private container: HTMLElement;
  private data: unknown;
  private expandedPaths: Set<string> = new Set();
  private intersectionObserver: IntersectionObserver | null = null;
  private lazyLoadState: Map<string, LazyLoadState> = new Map();
  private pendingRenders: Map<string, HTMLElement> = new Map();

  constructor(container: HTMLElement, data: unknown) {
    this.container = container;
    this.data = data;
    this.setupIntersectionObserver();
    this.render();
  }

  /**
   * Setup IntersectionObserver for lazy rendering
   */
  private setupIntersectionObserver(): void {
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            const path = target.dataset.lazyPath;
            if (path && this.pendingRenders.has(path)) {
              const contentEl = this.pendingRenders.get(path)!;
              target.replaceWith(contentEl);
              this.pendingRenders.delete(path);
              this.intersectionObserver?.unobserve(target);
            }
          }
        });
      },
      {
        root: this.container,
        rootMargin: "100px",
        threshold: 0,
      }
    );
  }

  /**
   * Cleanup and destroy component
   */
  destroy(): void {
    // Disconnect IntersectionObserver
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    this.expandedPaths.clear();
    this.lazyLoadState.clear();
    this.pendingRenders.clear();
    this.container.innerHTML = "";
  }

  /**
   * Update the data to display
   */
  setData(data: unknown): void {
    this.data = data;
    this.render();
  }

  /**
   * Render the tree
   */
  private render(): void {
    this.container.innerHTML = "";
    const tree = this.renderValue(this.data, "", 0);
    this.container.appendChild(tree);
  }

  /**
   * Check if depth exceeds maximum allowed
   */
  private isMaxDepthReached(depth: number): boolean {
    return depth >= PERFORMANCE.JSON_TREE_MAX_DEPTH;
  }

  /**
   * Render a value (recursive)
   */
  private renderValue(
    value: unknown,
    path: string,
    depth: number
  ): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "whitespace-nowrap";
    wrapper.style.marginLeft = `${depth * 16}px`;

    if (value === null) {
      wrapper.innerHTML = `<span class="text-devtools-text-muted italic">null</span>`;
      return wrapper;
    }

    if (typeof value === "undefined") {
      wrapper.innerHTML = `<span class="text-devtools-text-muted italic">undefined</span>`;
      return wrapper;
    }

    if (typeof value === "string") {
      wrapper.innerHTML = `<span class="text-devtools-accent-green">"${escapeHtml(this.truncateString(value))}"</span>`;
      return wrapper;
    }

    if (typeof value === "number") {
      wrapper.innerHTML = `<span class="text-devtools-accent-blue">${value}</span>`;
      return wrapper;
    }

    if (typeof value === "boolean") {
      wrapper.innerHTML = `<span class="text-devtools-accent-orange">${value}</span>`;
      return wrapper;
    }

    // Check depth limit for complex types
    if (this.isMaxDepthReached(depth)) {
      return this.renderDepthLimitMessage(value, wrapper);
    }

    if (Array.isArray(value)) {
      return this.renderArray(value, path, depth);
    }

    if (typeof value === "object") {
      return this.renderObject(value as Record<string, unknown>, path, depth);
    }

    wrapper.innerHTML = `<span class="text-devtools-text-muted">${String(value)}</span>`;
    return wrapper;
  }

  /**
   * Render depth limit reached message
   */
  private renderDepthLimitMessage(
    value: unknown,
    wrapper: HTMLElement
  ): HTMLElement {
    const isArray = Array.isArray(value);
    const count = isArray ? value.length : Object.keys(value as object).length;
    const type = isArray ? "Array" : "Object";
    wrapper.innerHTML = `
      <span class="text-devtools-text-muted italic">
        ${type}(${count}) - max depth reached
      </span>
    `;
    return wrapper;
  }

  /**
   * Get or initialize lazy load state for a path
   */
  private getLazyLoadState(path: string, totalCount: number): LazyLoadState {
    if (!this.lazyLoadState.has(path)) {
      const initialCount =
        totalCount > PERFORMANCE.LAZY_LOAD_THRESHOLD
          ? PERFORMANCE.LAZY_LOAD_THRESHOLD
          : totalCount;
      this.lazyLoadState.set(path, {
        loadedCount: initialCount,
        totalCount,
      });
    }
    return this.lazyLoadState.get(path)!;
  }

  /**
   * Load more items for a path
   */
  private loadMoreItems(path: string): void {
    const state = this.lazyLoadState.get(path);
    if (state) {
      state.loadedCount = Math.min(
        state.loadedCount + PERFORMANCE.LAZY_LOAD_THRESHOLD,
        state.totalCount
      );
      this.render();
    }
  }

  /**
   * Create "Load more" button
   */
  private createLoadMoreButton(path: string, remaining: number): HTMLElement {
    const button = document.createElement("button");
    button.className =
      "text-devtools-accent-blue hover:underline cursor-pointer text-xs my-1 ml-4";
    button.textContent = `Load ${Math.min(remaining, PERFORMANCE.LAZY_LOAD_THRESHOLD)} more... (${remaining} remaining)`;
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      this.loadMoreItems(path);
    });
    return button;
  }

  /**
   * Render an array
   */
  private renderArray(
    arr: unknown[],
    path: string,
    depth: number
  ): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "whitespace-nowrap";

    const isExpanded = this.expandedPaths.has(path);
    const isEmpty = arr.length === 0;

    if (isEmpty) {
      wrapper.innerHTML = `<span class="text-devtools-text-muted">[]</span>`;
      return wrapper;
    }

    const header = document.createElement("div");
    header.className =
      "cursor-pointer inline-block hover:bg-devtools-bg-hover rounded";
    header.innerHTML = `
      <span class="inline-block w-3 text-2xs ${isExpanded ? "text-devtools-text-secondary" : "text-devtools-text-muted"}">${isExpanded ? "▼" : "▶"}</span>
      <span class="text-devtools-text-muted">[</span>
      <span class="text-devtools-text-muted italic ml-1">${arr.length} items</span>
      ${isExpanded ? "" : '<span class="text-devtools-text-muted">]</span>'}
    `;

    header.addEventListener("click", () => {
      this.togglePath(path);
    });

    wrapper.appendChild(header);

    if (isExpanded) {
      const content = document.createElement("div");
      content.className = "ml-4";

      // Apply lazy loading for large arrays
      const lazyState = this.getLazyLoadState(path, arr.length);
      const itemsToRender = arr.slice(0, lazyState.loadedCount);

      itemsToRender.forEach((item, index) => {
        const itemPath = `${path}[${index}]`;
        const itemWrapper = document.createElement("div");
        itemWrapper.className = "leading-relaxed";

        const indexLabel = document.createElement("span");
        indexLabel.className = "text-devtools-text-muted";
        indexLabel.textContent = `${index}: `;
        itemWrapper.appendChild(indexLabel);

        const valueEl = this.renderValue(item, itemPath, depth + 1);
        valueEl.style.display = "inline-block";
        valueEl.style.marginLeft = "0";
        itemWrapper.appendChild(valueEl);

        content.appendChild(itemWrapper);
      });

      // Add "Load more" button if there are remaining items
      const remaining = arr.length - lazyState.loadedCount;
      if (remaining > 0) {
        content.appendChild(this.createLoadMoreButton(path, remaining));
      }

      wrapper.appendChild(content);

      const closeBracket = document.createElement("span");
      closeBracket.className = "text-devtools-text-muted";
      closeBracket.textContent = "]";
      wrapper.appendChild(closeBracket);
    }

    return wrapper;
  }

  /**
   * Render an object
   */
  private renderObject(
    obj: Record<string, unknown>,
    path: string,
    depth: number
  ): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "whitespace-nowrap";

    const keys = Object.keys(obj);
    const isExpanded = this.expandedPaths.has(path);
    const isEmpty = keys.length === 0;

    if (isEmpty) {
      wrapper.innerHTML = `<span class="text-devtools-text-muted">{}</span>`;
      return wrapper;
    }

    const header = document.createElement("div");
    header.className =
      "cursor-pointer inline-block hover:bg-devtools-bg-hover rounded";
    header.innerHTML = `
      <span class="inline-block w-3 text-2xs ${isExpanded ? "text-devtools-text-secondary" : "text-devtools-text-muted"}">${isExpanded ? "▼" : "▶"}</span>
      <span class="text-devtools-text-muted">{</span>
      <span class="text-devtools-text-muted italic ml-1">${keys.length} keys</span>
      ${isExpanded ? "" : '<span class="text-devtools-text-muted">}</span>'}
    `;

    header.addEventListener("click", () => {
      this.togglePath(path);
    });

    wrapper.appendChild(header);

    if (isExpanded) {
      const content = document.createElement("div");
      content.className = "ml-4";

      // Apply lazy loading for large objects
      const lazyState = this.getLazyLoadState(path, keys.length);
      const keysToRender = keys.slice(0, lazyState.loadedCount);

      keysToRender.forEach((key) => {
        const itemPath = path ? `${path}.${key}` : key;
        const itemWrapper = document.createElement("div");
        itemWrapper.className = "leading-relaxed";

        const keyLabel = document.createElement("span");
        keyLabel.className = "text-devtools-accent-purple";
        keyLabel.textContent = `${key}: `;
        itemWrapper.appendChild(keyLabel);

        const valueEl = this.renderValue(obj[key], itemPath, depth + 1);
        valueEl.style.display = "inline-block";
        valueEl.style.marginLeft = "0";
        itemWrapper.appendChild(valueEl);

        content.appendChild(itemWrapper);
      });

      // Add "Load more" button if there are remaining keys
      const remaining = keys.length - lazyState.loadedCount;
      if (remaining > 0) {
        content.appendChild(this.createLoadMoreButton(path, remaining));
      }

      wrapper.appendChild(content);

      const closeBracket = document.createElement("span");
      closeBracket.className = "text-devtools-text-muted";
      closeBracket.textContent = "}";
      wrapper.appendChild(closeBracket);
    }

    return wrapper;
  }

  /**
   * Toggle expanded state for a path
   */
  private togglePath(path: string): void {
    if (this.expandedPaths.has(path)) {
      this.expandedPaths.delete(path);
    } else {
      this.expandedPaths.add(path);
    }
    this.render();
  }

  /**
   * Expand all nodes
   */
  expandAll(): void {
    this.collectPaths(this.data, "");
    this.render();
  }

  /**
   * Collapse all nodes
   */
  collapseAll(): void {
    this.expandedPaths.clear();
    this.render();
  }

  /**
   * Collect all expandable paths (with depth limit)
   */
  private collectPaths(value: unknown, path: string, depth = 0): void {
    // Respect depth limit when expanding all
    if (depth >= PERFORMANCE.JSON_TREE_MAX_DEPTH) {
      return;
    }

    if (Array.isArray(value)) {
      this.expandedPaths.add(path);
      // Limit items to expand for performance
      const itemsToExpand = value.slice(0, PERFORMANCE.LAZY_LOAD_THRESHOLD);
      itemsToExpand.forEach((item, index) => {
        this.collectPaths(item, `${path}[${index}]`, depth + 1);
      });
    } else if (typeof value === "object" && value !== null) {
      this.expandedPaths.add(path);
      const keys = Object.keys(value);
      // Limit keys to expand for performance
      const keysToExpand = keys.slice(0, PERFORMANCE.LAZY_LOAD_THRESHOLD);
      keysToExpand.forEach((key) => {
        const itemPath = path ? `${path}.${key}` : key;
        this.collectPaths(
          (value as Record<string, unknown>)[key],
          itemPath,
          depth + 1
        );
      });
    }
  }

  /**
   * Truncate long strings for display
   */
  private truncateString(
    str: string,
    maxLength = UI.MAX_STRING_DISPLAY_LENGTH
  ): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength) + "...";
  }
}
