/**
 * PayloadList component
 * Displays payload entries in a table format similar to Chrome Network tab
 * Includes virtual scrolling for performance with large datasets
 */

import type { PayloadEntry } from "@/shared/types";
import { formatBytes } from "@/shared/parser";

// Virtual scrolling constants
const ROW_HEIGHT = 24; // pixels per row
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

  constructor(container: HTMLElement, onSelect: (index: number) => void) {
    this.container = container;
    this.onSelect = onSelect;

    this.render();
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
    this.container.innerHTML = `
      <div class="payload-scroll-container h-full overflow-auto relative">
        <table class="w-full border-collapse text-xs">
          <thead class="sticky top-0 bg-devtools-bg-secondary z-10">
            <tr>
              <th class="w-[40%] max-w-[200px] px-3 py-1.5 text-left font-medium text-devtools-text-secondary border-b border-devtools-border whitespace-nowrap">Name</th>
              <th class="w-[60px] px-3 py-1.5 text-left font-medium text-devtools-text-secondary border-b border-devtools-border whitespace-nowrap">Type</th>
              <th class="w-[70px] px-3 py-1.5 text-right font-medium text-devtools-text-secondary border-b border-devtools-border whitespace-nowrap">Size</th>
              <th class="w-[60px] px-3 py-1.5 text-right font-medium text-devtools-text-secondary border-b border-devtools-border whitespace-nowrap">Time</th>
            </tr>
          </thead>
          <tbody class="payload-tbody">
          </tbody>
        </table>
        <div class="virtual-spacer-top w-full pointer-events-none"></div>
        <div class="virtual-spacer-bottom w-full pointer-events-none"></div>
      </div>
      <div class="empty-state hidden flex-col items-center justify-center h-[200px] text-devtools-text-secondary">
        <p>No SSR payload detected</p>
        <p class="text-xs text-devtools-text-muted mt-1">Navigate to a Next.js page to see SSR data</p>
      </div>
    `;

    // Setup scroll listener for virtual scrolling
    this.scrollContainer = this.container.querySelector(
      ".payload-scroll-container"
    );
    if (this.scrollContainer) {
      this.scrollContainer.addEventListener(
        "scroll",
        this.handleScroll.bind(this)
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
   * Render a single entry row
   */
  private renderEntry(entry: PayloadEntry, index: number): string {
    const isSelected = index === this.selectedIndex;
    const typeClass = `type-${entry.type.toLowerCase()}`;
    const selectedClass = isSelected ? "bg-devtools-bg-selected" : "";

    return `
      <tr class="payload-row cursor-pointer border-b border-devtools-border hover:bg-devtools-bg-hover ${selectedClass}" data-index="${index}">
        <td class="w-[40%] max-w-[200px] px-3 py-1 whitespace-nowrap overflow-hidden text-ellipsis" title="${this.escapeHtml(
          entry.name
        )}">
          <span class="text-devtools-text-primary">${this.escapeHtml(
            entry.name
          )}</span>
        </td>
        <td class="w-[60px] px-3 py-1 whitespace-nowrap overflow-hidden text-ellipsis">
          <span class="inline-block px-1.5 py-0.5 rounded text-2xs font-medium ${typeClass}">${
            entry.type
          }</span>
        </td>
        <td class="w-[70px] px-3 py-1 text-right whitespace-nowrap overflow-hidden text-ellipsis">${formatBytes(
          entry.size
        )}</td>
        <td class="w-[60px] px-3 py-1 text-right whitespace-nowrap overflow-hidden text-ellipsis">${this.formatTimestamp(
          entry.timestamp
        )}</td>
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
   * Update selection styling
   */
  private updateSelection(): void {
    const rows = this.container.querySelectorAll(".payload-row");
    rows.forEach((row, index) => {
      if (index === this.selectedIndex) {
        row.classList.add("bg-devtools-bg-selected");
        row.classList.remove("hover:bg-devtools-bg-hover");
      } else {
        row.classList.remove("bg-devtools-bg-selected");
        row.classList.add("hover:bg-devtools-bg-hover");
      }
    });
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Format timestamp for display
   */
  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
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
    const headerHeight = 28; // Approximate header height

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
