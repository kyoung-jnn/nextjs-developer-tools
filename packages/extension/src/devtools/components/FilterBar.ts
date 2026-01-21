/**
 * FilterBar component
 * Provides type filters, search input, and sort options
 * Uses DaisyUI components
 */

import type { FilterState, PayloadType, SortField } from "@/shared/types";

export class FilterBar {
  private container: HTMLElement;
  private onChange: (filter: FilterState) => void;
  private currentFilter: FilterState;
  private abortController: AbortController | null = null;

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
   * Cleanup and destroy component
   */
  destroy(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.container.innerHTML = "";
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
      <div class="flex items-center gap-3 w-full">
        <!-- Type filter buttons -->
        <div class="join">
          <button class="filter-btn join-item btn btn-xs btn-primary" data-filter="all">All</button>
          <button class="filter-btn join-item btn btn-xs btn-ghost" data-filter="pageProps">Props</button>
          <button class="filter-btn join-item btn btn-xs btn-ghost" data-filter="rsc">RSC</button>
        </div>

        <!-- Search input -->
        <div class="flex-1 min-w-[120px]">
          <input
            type="text"
            class="search-input input input-xs input-bordered w-full"
            placeholder="Search..."
          />
        </div>

        <!-- Sort controls -->
        <div class="flex items-center gap-1">
          <select class="sort-select select select-xs select-bordered">
            <option value="name">Name</option>
            <option value="size">Size</option>
            <option value="timestamp">Time</option>
          </select>
          <button
            class="sort-order-btn btn btn-xs btn-ghost btn-square"
            data-order="asc"
            title="Sort order"
          >↑</button>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // 기존 리스너 정리
    this.abortController?.abort();
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    // Type filter buttons
    const filterButtons = this.container.querySelectorAll(".filter-btn");
    filterButtons.forEach((btn) => {
      btn.addEventListener(
        "click",
        (e) => {
          const target = e.target as HTMLElement;
          const filter = target.dataset.filter ?? "all";
          this.handleTypeFilterChange(filter);
        },
        { signal }
      );
    });

    // Search input
    const searchInput = this.container.querySelector(
      ".search-input"
    ) as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener(
        "input",
        (e) => {
          const target = e.target as HTMLInputElement;
          this.handleSearchChange(target.value);
        },
        { signal }
      );
    }

    // Sort select
    const sortSelect = this.container.querySelector(
      ".sort-select"
    ) as HTMLSelectElement;
    if (sortSelect) {
      sortSelect.addEventListener(
        "change",
        (e) => {
          const target = e.target as HTMLSelectElement;
          this.handleSortFieldChange(target.value as SortField);
        },
        { signal }
      );
    }

    // Sort order button
    const sortOrderBtn = this.container.querySelector(".sort-order-btn");
    if (sortOrderBtn) {
      sortOrderBtn.addEventListener(
        "click",
        () => {
          this.handleSortOrderToggle();
        },
        { signal }
      );
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

    buttons.forEach((btn) => {
      const filter = (btn as HTMLElement).dataset.filter;
      const isActive =
        filter === "all"
          ? this.currentFilter.typeFilter.length === 0
          : this.currentFilter.typeFilter.includes(filter as PayloadType);

      btn.classList.remove("btn-primary", "btn-ghost");
      btn.classList.add(isActive ? "btn-primary" : "btn-ghost");
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
