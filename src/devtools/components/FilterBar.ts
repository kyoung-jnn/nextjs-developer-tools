/**
 * FilterBar component
 * Provides type filters, search input, and sort options
 */

import type { FilterState, PayloadType, SortField } from "@/shared/types";

export class FilterBar {
  private container: HTMLElement;
  private onChange: (filter: FilterState) => void;
  private currentFilter: FilterState;

  constructor(container: HTMLElement, onChange: (filter: FilterState) => void) {
    this.container = container;
    this.onChange = onChange;
    this.currentFilter = {
      typeFilter: [],
      searchQuery: "",
      sortBy: "name",
      sortOrder: "asc",
    };

    this.render();
  }

  /**
   * Set current filter values
   */
  setFilter(filter: FilterState): void {
    this.currentFilter = { ...filter };
    this.updateUI();
  }

  /**
   * Render the filter bar
   */
  private render(): void {
    this.container.innerHTML = `
      <div class="flex items-center gap-3 px-3 py-1.5 bg-devtools-bg-secondary">
        <div class="flex gap-1">
          <button class="filter-btn px-2.5 py-1 border border-devtools-border rounded text-xs cursor-pointer transition-all duration-150 bg-devtools-accent-blue text-devtools-bg-primary border-devtools-accent-blue" data-filter="all">All</button>
          <button class="filter-btn px-2.5 py-1 border border-devtools-border rounded text-xs cursor-pointer transition-all duration-150 bg-devtools-bg-primary text-devtools-text-secondary hover:bg-devtools-bg-hover hover:text-devtools-text-primary" data-filter="pageProps">Props</button>
          <button class="filter-btn px-2.5 py-1 border border-devtools-border rounded text-xs cursor-pointer transition-all duration-150 bg-devtools-bg-primary text-devtools-text-secondary hover:bg-devtools-bg-hover hover:text-devtools-text-primary" data-filter="rsc">RSC</button>
        </div>
        <div class="flex-1 min-w-[150px]">
          <input type="text" class="search-input w-full px-2 py-1 border border-devtools-border rounded bg-devtools-bg-primary text-devtools-text-primary text-xs placeholder:text-devtools-text-muted focus:outline-none focus:border-devtools-accent-blue" placeholder="Search..." />
        </div>
        <div class="flex items-center gap-1">
          <select class="sort-select px-2 py-1 border border-devtools-border rounded bg-devtools-bg-primary text-devtools-text-primary text-xs cursor-pointer">
            <option value="name">Name</option>
            <option value="size">Size</option>
            <option value="timestamp">Time</option>
          </select>
          <button class="sort-order-btn px-2 py-1 border border-devtools-border rounded bg-devtools-bg-primary text-devtools-text-secondary text-xs cursor-pointer hover:bg-devtools-bg-hover" data-order="asc" title="Sort order">↑</button>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Type filter buttons
    const filterButtons = this.container.querySelectorAll(".filter-btn");
    filterButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const filter = target.dataset.filter ?? "all";
        this.handleTypeFilterChange(filter);
      });
    });

    // Search input
    const searchInput = this.container.querySelector(
      ".search-input"
    ) as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const target = e.target as HTMLInputElement;
        this.handleSearchChange(target.value);
      });
    }

    // Sort select
    const sortSelect = this.container.querySelector(
      ".sort-select"
    ) as HTMLSelectElement;
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        const target = e.target as HTMLSelectElement;
        this.handleSortFieldChange(target.value as SortField);
      });
    }

    // Sort order button
    const sortOrderBtn = this.container.querySelector(".sort-order-btn");
    if (sortOrderBtn) {
      sortOrderBtn.addEventListener("click", () => {
        this.handleSortOrderToggle();
      });
    }
  }

  /**
   * Handle type filter change
   * 'all' clears the filter, other values toggle the type in the array
   */
  private handleTypeFilterChange(filter: string): void {
    if (filter === "all") {
      this.currentFilter.typeFilter = [];
    } else {
      const payloadType = filter as PayloadType;
      const index = this.currentFilter.typeFilter.indexOf(payloadType);
      if (index >= 0) {
        this.currentFilter.typeFilter = this.currentFilter.typeFilter.filter(
          (t) => t !== payloadType
        );
      } else {
        this.currentFilter.typeFilter = [
          ...this.currentFilter.typeFilter,
          payloadType,
        ];
      }
    }
    this.updateFilterButtons();
    this.onChange(this.currentFilter);
  }

  /**
   * Handle search input change
   */
  private handleSearchChange(query: string): void {
    this.currentFilter.searchQuery = query;
    this.onChange(this.currentFilter);
  }

  /**
   * Handle sort field change
   */
  private handleSortFieldChange(field: SortField): void {
    this.currentFilter.sortBy = field;
    this.onChange(this.currentFilter);
  }

  /**
   * Handle sort order toggle
   */
  private handleSortOrderToggle(): void {
    this.currentFilter.sortOrder =
      this.currentFilter.sortOrder === "asc" ? "desc" : "asc";
    this.updateSortOrderButton();
    this.onChange(this.currentFilter);
  }

  /**
   * Update filter button states
   */
  private updateFilterButtons(): void {
    const buttons = this.container.querySelectorAll(".filter-btn");
    const activeClasses =
      "bg-devtools-accent-blue text-devtools-bg-primary border-devtools-accent-blue";
    const inactiveClasses =
      "bg-devtools-bg-primary text-devtools-text-secondary";

    buttons.forEach((btn) => {
      const filter = (btn as HTMLElement).dataset.filter;
      const isActive =
        filter === "all"
          ? this.currentFilter.typeFilter.length === 0
          : this.currentFilter.typeFilter.includes(filter as PayloadType);

      // Remove all state classes first
      btn.classList.remove(
        "bg-devtools-accent-blue",
        "text-devtools-bg-primary",
        "border-devtools-accent-blue",
        "bg-devtools-bg-primary",
        "text-devtools-text-secondary"
      );

      // Add appropriate classes
      if (isActive) {
        activeClasses.split(" ").forEach((c) => btn.classList.add(c));
      } else {
        inactiveClasses.split(" ").forEach((c) => btn.classList.add(c));
      }
    });
  }

  /**
   * Update sort order button
   */
  private updateSortOrderButton(): void {
    const btn = this.container.querySelector(".sort-order-btn");
    if (btn) {
      btn.textContent = this.currentFilter.sortOrder === "asc" ? "↑" : "↓";
      (btn as HTMLElement).dataset.order = this.currentFilter.sortOrder;
    }
  }

  /**
   * Update all UI elements to match current filter
   */
  private updateUI(): void {
    this.updateFilterButtons();

    const searchInput = this.container.querySelector(
      ".search-input"
    ) as HTMLInputElement;
    if (searchInput) {
      searchInput.value = this.currentFilter.searchQuery;
    }

    const sortSelect = this.container.querySelector(
      ".sort-select"
    ) as HTMLSelectElement;
    if (sortSelect) {
      sortSelect.value = this.currentFilter.sortBy;
    }

    this.updateSortOrderButton();
  }
}
