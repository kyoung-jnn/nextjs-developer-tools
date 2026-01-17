/**
 * JsonTree component
 * Renders JSON data as an expandable/collapsible tree view
 */

export class JsonTree {
  private container: HTMLElement;
  private data: unknown;
  private expandedPaths: Set<string> = new Set();

  constructor(container: HTMLElement, data: unknown) {
    this.container = container;
    this.data = data;
    this.render();
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
      wrapper.innerHTML = `<span class="text-devtools-accent-green">"${this.escapeHtml(this.truncateString(value))}"</span>`;
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
   * Render an array
   */
  private renderArray(
    arr: unknown[],
    path: string,
    _depth: number
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

      arr.forEach((item, index) => {
        const itemPath = `${path}[${index}]`;
        const itemWrapper = document.createElement("div");
        itemWrapper.className = "leading-relaxed";

        const indexLabel = document.createElement("span");
        indexLabel.className = "text-devtools-text-muted";
        indexLabel.textContent = `${index}: `;
        itemWrapper.appendChild(indexLabel);

        const valueEl = this.renderValue(item, itemPath, 0);
        valueEl.style.display = "inline-block";
        valueEl.style.marginLeft = "0";
        itemWrapper.appendChild(valueEl);

        content.appendChild(itemWrapper);
      });

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
    _depth: number
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

      keys.forEach((key) => {
        const itemPath = path ? `${path}.${key}` : key;
        const itemWrapper = document.createElement("div");
        itemWrapper.className = "leading-relaxed";

        const keyLabel = document.createElement("span");
        keyLabel.className = "text-devtools-accent-purple";
        keyLabel.textContent = `${key}: `;
        itemWrapper.appendChild(keyLabel);

        const valueEl = this.renderValue(obj[key], itemPath, 0);
        valueEl.style.display = "inline-block";
        valueEl.style.marginLeft = "0";
        itemWrapper.appendChild(valueEl);

        content.appendChild(itemWrapper);
      });

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
   * Collect all expandable paths
   */
  private collectPaths(value: unknown, path: string): void {
    if (Array.isArray(value)) {
      this.expandedPaths.add(path);
      value.forEach((item, index) => {
        this.collectPaths(item, `${path}[${index}]`);
      });
    } else if (typeof value === "object" && value !== null) {
      this.expandedPaths.add(path);
      Object.keys(value).forEach((key) => {
        const itemPath = path ? `${path}.${key}` : key;
        this.collectPaths((value as Record<string, unknown>)[key], itemPath);
      });
    }
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Truncate long strings for display
   */
  private truncateString(str: string, maxLength = 100): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength) + "...";
  }
}
