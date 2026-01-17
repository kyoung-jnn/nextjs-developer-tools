/**
 * DetailPanel component
 * Shows detailed information about selected payload entry
 * Includes Headers, Payload, and Preview tabs
 */

import type { PayloadEntry } from "@/shared/types";
import { formatBytes } from "@/shared/parser";
import { JsonTree } from "./JsonTree";

type TabType = "headers" | "payload" | "preview";

export class DetailPanel {
  private container: HTMLElement;
  private currentEntry: PayloadEntry | null = null;
  private currentTab: TabType = "preview";

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }

  /**
   * Set the entry to display
   */
  setEntry(entry: PayloadEntry | null): void {
    this.currentEntry = entry;
    this.renderContent();
  }

  /**
   * Render the panel structure
   */
  private render(): void {
    this.container.innerHTML = `
      <div class="flex flex-col h-full">
        <div class="flex gap-1 px-3 py-1.5 bg-devtools-bg-secondary border-b border-devtools-border">
          <button class="detail-tab px-2.5 py-1 border-none bg-transparent text-devtools-text-secondary text-xs cursor-pointer rounded hover:bg-devtools-bg-hover hover:text-devtools-text-primary" data-tab="headers">Headers</button>
          <button class="detail-tab px-2.5 py-1 border-none bg-transparent text-devtools-text-secondary text-xs cursor-pointer rounded hover:bg-devtools-bg-hover hover:text-devtools-text-primary" data-tab="payload">Payload</button>
          <button class="detail-tab px-2.5 py-1 border-none bg-devtools-bg-tertiary text-devtools-text-primary text-xs cursor-pointer rounded" data-tab="preview">Preview</button>
        </div>
        <div class="detail-content flex-1 overflow-auto p-3">
          <div class="flex items-center justify-center h-full text-devtools-text-muted">
            <p>Select an item to view details</p>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    const tabs = this.container.querySelectorAll(".detail-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const tabType = target.dataset.tab as TabType;
        this.handleTabChange(tabType);
      });
    });
  }

  /**
   * Handle tab change
   */
  private handleTabChange(tab: TabType): void {
    this.currentTab = tab;
    this.updateTabUI();
    this.renderContent();
  }

  /**
   * Update tab button states
   */
  private updateTabUI(): void {
    const tabs = this.container.querySelectorAll(".detail-tab");
    tabs.forEach((tab) => {
      const tabType = (tab as HTMLElement).dataset.tab;
      if (tabType === this.currentTab) {
        tab.classList.add(
          "bg-devtools-bg-tertiary",
          "text-devtools-text-primary"
        );
        tab.classList.remove("bg-transparent", "text-devtools-text-secondary");
      } else {
        tab.classList.remove(
          "bg-devtools-bg-tertiary",
          "text-devtools-text-primary"
        );
        tab.classList.add("bg-transparent", "text-devtools-text-secondary");
      }
    });
  }

  /**
   * Render content based on current tab and entry
   */
  private renderContent(): void {
    const content = this.container.querySelector(".detail-content");
    if (!content) return;

    if (!this.currentEntry) {
      content.innerHTML = `
        <div class="flex items-center justify-center h-full text-devtools-text-muted">
          <p>Select an item to view details</p>
        </div>
      `;
      return;
    }

    switch (this.currentTab) {
      case "headers":
        this.renderHeaders(content);
        break;
      case "payload":
        this.renderPayload(content);
        break;
      case "preview":
        this.renderPreview(content);
        break;
    }
  }

  /**
   * Render headers tab content
   */
  private renderHeaders(content: Element): void {
    if (!this.currentEntry) return;

    const entry = this.currentEntry;
    const typeClass = `type-${entry.type.toLowerCase()}`;

    content.innerHTML = `
      <div class="text-xs">
        <h4 class="text-2xs uppercase text-devtools-text-secondary mb-2">General</h4>
        <dl class="grid grid-cols-[100px_1fr] gap-y-1 gap-x-3">
          <dt class="text-devtools-text-secondary">Name</dt>
          <dd class="text-devtools-text-primary">${this.escapeHtml(entry.name)}</dd>
          <dt class="text-devtools-text-secondary">Type</dt>
          <dd><span class="inline-block px-1.5 py-0.5 rounded text-2xs font-medium ${typeClass}">${entry.type}</span></dd>
          <dt class="text-devtools-text-secondary">Size</dt>
          <dd class="text-devtools-text-primary">${formatBytes(entry.size)}</dd>
          <dt class="text-devtools-text-secondary">Extracted At</dt>
          <dd class="text-devtools-text-primary">${this.formatTimestamp(entry.timestamp)}</dd>
        </dl>
      </div>
    `;
  }

  /**
   * Format timestamp for display
   */
  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  /**
   * Render payload tab content (raw JSON)
   */
  private renderPayload(content: Element): void {
    if (!this.currentEntry) return;

    const jsonString = JSON.stringify(this.currentEntry.data, null, 2);

    content.innerHTML = `
      <div class="relative">
        <pre class="font-mono text-xs leading-relaxed bg-devtools-bg-secondary p-3 rounded overflow-auto max-h-[calc(100vh-200px)] whitespace-pre-wrap break-all"><code>${this.escapeHtml(jsonString)}</code></pre>
        <button class="copy-btn absolute top-2 right-2 px-2 py-1 border border-devtools-border rounded bg-devtools-bg-primary text-devtools-text-secondary text-2xs cursor-pointer hover:bg-devtools-bg-hover hover:text-devtools-text-primary" title="Copy to clipboard">Copy</button>
      </div>
    `;

    // Attach copy handler
    const copyBtn = content.querySelector(".copy-btn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(jsonString).then(() => {
          (copyBtn as HTMLButtonElement).textContent = "Copied!";
          setTimeout(() => {
            (copyBtn as HTMLButtonElement).textContent = "Copy";
          }, 1500);
        });
      });
    }
  }

  /**
   * Render preview tab content (JSON tree)
   */
  private renderPreview(content: Element): void {
    if (!this.currentEntry) return;

    content.innerHTML = `
      <div>
        <div class="json-tree-container font-mono text-xs leading-relaxed"></div>
      </div>
    `;

    const treeContainer = content.querySelector(".json-tree-container");
    if (treeContainer) {
      new JsonTree(treeContainer as HTMLElement, this.currentEntry.data);
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
