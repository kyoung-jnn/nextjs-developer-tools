/**
 * PayloadList component
 * Displays payload entries in a table format using DaisyUI
 * Includes virtual scrolling for performance with large datasets
 */

import type { PayloadEntry } from "@/shared/types";
import { escapeHtml } from "@/shared/utils";
import { formatTimestamp, formatBytes } from "@/shared/formatters";
import { getBadgeClassName, BADGE_CONFIG } from "@/shared/constants";

// Virtual scrolling constants
const ROW_HEIGHT = 32; // pixels per row
const BUFFER_SIZE = 5; // extra rows to render above/below viewport
const VIRTUAL_SCROLL_THRESHOLD = 100; // Enable virtual scrolling when entries exceed this

export class PayloadList {
  private container: HTMLElement;
  private onSelect: (index: number) => void;
  private entries: PayloadEntry[] = [];
  private selectedIndex = -1;
  private useVirtualScroll = false;
  private visibleStartIndex = 0;
  private visibleEndIndex = 0;
  private scrollContainer: HTMLElement | null = null;
  private abortController: AbortController | null = null;

  constructor(container: HTMLElement, onSelect: (index: number) => void) {
    this.container = container;
    this.onSelect = onSelect;

    this.render();
  }

  /**
   * Cleanup and destroy component
   */
  destroy(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.scrollContainer = null;
    this.container.innerHTML = "";
  }

  /**
   * Set entries to display
   */
  setEntries(entries: PayloadEntry[]): void {
    this.entries = entries;
    this.useVirtualScroll = entries.length > VIRTUAL_SCROLL_THRESHOLD;

    if (this.useVirtualScroll) {
      this.renderVirtualEntries();
    } else {
      this.renderEntries();
    }
  }

  /**
   * Set selected index
   */
  setSelectedIndex(index: number): void {
    this.selectedIndex = index;
    this.updateSelection();
  }

  /**
   * Render the table structure
   */
  private render(): void {
    // 기존 리스너 정리
    this.abortController?.abort();
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    this.container.innerHTML = `
      <div class="payload-scroll-container h-full overflow-auto relative" role="grid" aria-label="Payload entries">
        <table class="table table-xs table-pin-rows w-full">
          <thead role="rowgroup">
            <tr class="bg-base-200" role="row">
              <th class="w-[40%] max-w-[200px]" role="columnheader" scope="col">Name</th>
              <th class="w-[60px]" role="columnheader" scope="col">Type</th>
              <th class="w-[70px] text-right" role="columnheader" scope="col">Size</th>
              <th class="w-[60px] text-right" role="columnheader" scope="col">Time</th>
            </tr>
          </thead>
          <tbody class="payload-tbody" role="rowgroup">
          </tbody>
        </table>
        <div class="virtual-spacer-top w-full pointer-events-none" aria-hidden="true"></div>
        <div class="virtual-spacer-bottom w-full pointer-events-none" aria-hidden="true"></div>
      </div>
      <div class="empty-state hidden" role="status" aria-live="polite">
        <div class="flex flex-col items-center justify-center h-[200px] text-base-content/50">
          <p>No SSR payload detected</p>
          <p class="text-xs opacity-60 mt-1">Navigate to a Next.js page to see SSR data</p>
        </div>
      </div>
    `;

    // Setup scroll listener for virtual scrolling
    this.scrollContainer = this.container.querySelector(
      ".payload-scroll-container"
    );
    if (this.scrollContainer) {
      this.scrollContainer.addEventListener(
        "scroll",
        this.handleScroll.bind(this),
        { signal }
      );
    }
  }

  /**
   * Render entries into the table
   */
  private renderEntries(): void {
    const tbody = this.container.querySelector(".payload-tbody");
    const emptyState = this.container.querySelector(".empty-state");

    if (!tbody || !emptyState) return;

    if (this.entries.length === 0) {
      tbody.innerHTML = "";
      emptyState.classList.remove("hidden");
      emptyState.classList.add("flex");
      return;
    }

    emptyState.classList.add("hidden");
    emptyState.classList.remove("flex");

    tbody.innerHTML = this.entries
      .map((entry, index) => this.renderEntry(entry, index))
      .join("");

    // Attach click handlers
    const rows = tbody.querySelectorAll("tr");
    rows.forEach((row, index) => {
      row.addEventListener("click", () => {
        this.handleSelect(index);
      });
    });
  }

  /**
   * Get accessible description for payload type
   */
  private getTypeDescription(type: string): string {
    const config = BADGE_CONFIG[type as keyof typeof BADGE_CONFIG];
    return config?.description ?? `${type} payload data`;
  }

  /**
   * Render a single entry row
   */
  private renderEntry(entry: PayloadEntry, index: number): string {
    const isSelected = index === this.selectedIndex;
    const badgeClass = getBadgeClassName(entry.type);
    const typeLabel =
      BADGE_CONFIG[entry.type as keyof typeof BADGE_CONFIG]?.label ??
      entry.type;
    const typeDescription = this.getTypeDescription(entry.type);

    return `
      <tr
        class="payload-row cursor-pointer hover ${isSelected ? "bg-primary/20" : ""}"
        data-index="${index}"
        role="row"
        tabindex="${isSelected ? "0" : "-1"}"
        aria-selected="${isSelected}"
        aria-label="${escapeHtml(entry.name)}, ${typeLabel} payload, ${formatBytes(entry.size)}"
      >
        <td class="w-[40%] max-w-[200px] truncate" title="${escapeHtml(entry.name)}" role="gridcell">
          ${escapeHtml(entry.name)}
        </td>
        <td class="w-[60px]" role="gridcell">
          <span
            class="badge badge-sm ${badgeClass}"
            aria-label="${typeLabel}"
            title="${typeDescription}"
          >
            <span aria-hidden="true">${typeLabel}</span>
            <span class="sr-only">${typeDescription}</span>
          </span>
        </td>
        <td class="w-[70px] text-right font-mono" role="gridcell" aria-label="${formatBytes(entry.size)}">
          ${formatBytes(entry.size)}
        </td>
        <td class="w-[60px] text-right font-mono" role="gridcell" aria-label="${formatTimestamp(entry.timestamp, "full")}">
          ${formatTimestamp(entry.timestamp, "time")}
        </td>
      </tr>
    `;
  }

  /**
   * Handle row selection
   */
  private handleSelect(index: number): void {
    this.selectedIndex = index;
    this.updateSelection();
    this.onSelect(index);
  }

  /**
   * Update selection styling and ARIA attributes
   */
  private updateSelection(): void {
    const rows = this.container.querySelectorAll(".payload-row");
    rows.forEach((row) => {
      const rowElement = row as HTMLElement;
      const rowIndex = parseInt(rowElement.dataset.index || "-1", 10);
      const isSelected = rowIndex === this.selectedIndex;

      if (isSelected) {
        row.classList.add("bg-primary/20");
        rowElement.setAttribute("aria-selected", "true");
        rowElement.setAttribute("tabindex", "0");
      } else {
        row.classList.remove("bg-primary/20");
        rowElement.setAttribute("aria-selected", "false");
        rowElement.setAttribute("tabindex", "-1");
      }
    });
  }

  /**
   * Handle scroll event for virtual scrolling
   */
  private handleScroll(): void {
    if (!this.useVirtualScroll || !this.scrollContainer) return;

    // Debounce scroll handling
    requestAnimationFrame(() => {
      this.updateVirtualScroll();
    });
  }

  /**
   * Render entries with virtual scrolling
   */
  private renderVirtualEntries(): void {
    const tbody = this.container.querySelector(".payload-tbody");
    const emptyState = this.container.querySelector(".empty-state");

    if (!tbody || !emptyState) return;

    if (this.entries.length === 0) {
      tbody.innerHTML = "";
      emptyState.classList.remove("hidden");
      emptyState.classList.add("flex");
      return;
    }

    emptyState.classList.add("hidden");
    emptyState.classList.remove("flex");
    this.updateVirtualScroll();
  }

  /**
   * Update virtual scroll rendering
   */
  private updateVirtualScroll(): void {
    if (!this.scrollContainer) return;

    const tbody = this.container.querySelector(".payload-tbody");
    const topSpacer = this.container.querySelector(
      ".virtual-spacer-top"
    ) as HTMLElement;
    const bottomSpacer = this.container.querySelector(
      ".virtual-spacer-bottom"
    ) as HTMLElement;

    if (!tbody || !topSpacer || !bottomSpacer) return;

    const scrollTop = this.scrollContainer.scrollTop;
    const viewportHeight = this.scrollContainer.clientHeight;
    const headerHeight = 32; // Approximate header height

    // Calculate visible range
    this.visibleStartIndex = Math.max(
      0,
      Math.floor((scrollTop - headerHeight) / ROW_HEIGHT) - BUFFER_SIZE
    );
    this.visibleEndIndex = Math.min(
      this.entries.length,
      Math.ceil((scrollTop + viewportHeight - headerHeight) / ROW_HEIGHT) +
        BUFFER_SIZE
    );

    // Update spacers
    topSpacer.style.height = `${this.visibleStartIndex * ROW_HEIGHT}px`;
    bottomSpacer.style.height = `${Math.max(
      0,
      (this.entries.length - this.visibleEndIndex) * ROW_HEIGHT
    )}px`;

    // Render only visible entries
    const visibleEntries = this.entries.slice(
      this.visibleStartIndex,
      this.visibleEndIndex
    );
    tbody.innerHTML = visibleEntries
      .map((entry, i) => this.renderEntry(entry, this.visibleStartIndex + i))
      .join("");

    // Attach click handlers
    const rows = tbody.querySelectorAll("tr");
    rows.forEach((row) => {
      const index = parseInt((row as HTMLElement).dataset.index || "0", 10);
      row.addEventListener("click", () => {
        this.handleSelect(index);
      });
    });
  }

  /**
   * Handle keyboard navigation
   */
  handleKeyDown(event: KeyboardEvent): void {
    if (this.entries.length === 0) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (this.selectedIndex < this.entries.length - 1) {
          this.handleSelect(this.selectedIndex + 1);
        }
        break;

      case "ArrowUp":
        event.preventDefault();
        if (this.selectedIndex > 0) {
          this.handleSelect(this.selectedIndex - 1);
        }
        break;

      case "Home":
        event.preventDefault();
        this.handleSelect(0);
        break;

      case "End":
        event.preventDefault();
        this.handleSelect(this.entries.length - 1);
        break;
    }
  }
}
