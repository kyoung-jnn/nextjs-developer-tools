/**
 * DetailPanel component
 * Shows detailed information about selected payload entry
 * Uses DaisyUI tabs, badges, and buttons
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
        <!-- Tabs -->
        <div role="tablist" class="tabs tabs-bordered tabs-xs bg-base-200 px-2">
          <button role="tab" class="detail-tab tab" data-tab="headers">Headers</button>
          <button role="tab" class="detail-tab tab" data-tab="payload">Payload</button>
          <button role="tab" class="detail-tab tab tab-active" data-tab="preview">Preview</button>
        </div>

        <!-- Content -->
        <div class="detail-content flex-1 overflow-auto p-3">
          <div class="flex items-center justify-center h-full text-base-content/40">
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
        tab.classList.add("tab-active");
      } else {
        tab.classList.remove("tab-active");
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
        <div class="flex items-center justify-center h-full text-base-content/40">
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
    const badgeClass = this.getBadgeClass(entry.type);

    content.innerHTML = `
      <div class="text-sm">
        <h4 class="text-xs uppercase text-base-content/50 mb-3 font-semibold">General</h4>
        <div class="overflow-x-auto">
          <table class="table table-xs">
            <tbody>
              <tr>
                <td class="text-base-content/60 w-24">Name</td>
                <td class="font-medium">${this.escapeHtml(entry.name)}</td>
              </tr>
              <tr>
                <td class="text-base-content/60">Type</td>
                <td><span class="badge badge-sm ${badgeClass}">${entry.type}</span></td>
              </tr>
              <tr>
                <td class="text-base-content/60">Size</td>
                <td class="font-mono">${formatBytes(entry.size)}</td>
              </tr>
              <tr>
                <td class="text-base-content/60">Extracted At</td>
                <td class="font-mono">${this.formatTimestamp(entry.timestamp)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * Get badge class based on payload type
   */
  private getBadgeClass(type: string): string {
    switch (type.toLowerCase()) {
      case "rsc":
        return "badge-secondary";
      case "pageprops":
        return "badge-primary";
      case "ssr":
        return "badge-success";
      case "ssg":
        return "badge-info";
      case "isr":
        return "badge-warning";
      default:
        return "badge-ghost";
    }
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
        <div class="mockup-code bg-base-200 text-xs max-h-[calc(100vh-200px)] overflow-auto">
          <pre class="px-4"><code>${this.escapeHtml(jsonString)}</code></pre>
        </div>
        <button class="copy-btn btn btn-xs btn-ghost absolute top-2 right-2" title="Copy to clipboard">
          Copy
        </button>
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
      <div class="json-tree-container font-mono text-xs leading-relaxed"></div>
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
