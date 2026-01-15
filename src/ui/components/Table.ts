/**
 * Table - Data-driven table component
 * Displays entities in rows with configurable columns
 */

import { Container, FederatedPointerEvent, Graphics, Text, TextStyle } from 'pixi.js';
import { UIComponent } from './UIComponent';
import { COLORS, SPACING, FONTS } from '../UITheme';
import { type ColumnDef, renderCell } from '../UIConfig';

export interface TableOptions<T> {
  columns: ColumnDef<T>[];
  onRowClick?: (item: T) => void;
  rowHeight?: number;
  headerHeight?: number;
}

interface SortState {
  columnKey: string;
  direction: 'asc' | 'desc';
}

interface TableRow {
  container: Container;
  background: Graphics;
  cells: Text[];
}

export class Table<T extends { id: string }> extends UIComponent {
  private columns: ColumnDef<T>[];
  private columnWidths: number[]; // Dynamic widths (for resizing)
  private data: T[] = [];
  private originalData: T[] = []; // Keep unsorted copy
  private rows: TableRow[] = [];
  private selectedId?: string;
  private onRowClick?: (item: T) => void;
  private rowHeight: number;
  private headerHeight: number;
  private sortState?: SortState;

  private headerContainer: Container;
  private headerBg: Graphics;
  private headerTexts: Text[] = [];
  private columnDividers: Graphics;
  private resizeHandles: Graphics[] = [];
  private bodyContainer: Container;
  private bodyMask: Graphics;
  private scrollOffset = 0;

  // Resize state
  private resizing: { columnIndex: number; startX: number; startWidth: number } | null = null;
  private boundOnResizeMove: (e: PointerEvent) => void;
  private boundOnResizeEnd: () => void;

  constructor(width: number, height: number, options: TableOptions<T>) {
    super(width, height);
    this.columns = options.columns;
    this.columnWidths = options.columns.map((c) => c.width); // Initialize from config
    this.onRowClick = options.onRowClick;
    this.rowHeight = options.rowHeight ?? SPACING.rowHeight;
    this.headerHeight = options.headerHeight ?? SPACING.rowHeight;

    // Bind resize handlers
    this.boundOnResizeMove = this.onResizeMove.bind(this);
    this.boundOnResizeEnd = this.onResizeEnd.bind(this);

    // Header
    this.headerBg = new Graphics();
    this.addChild(this.headerBg);

    this.headerContainer = new Container();
    this.addChild(this.headerContainer);
    this.createHeader();

    // Body with mask for scrolling
    this.bodyMask = new Graphics();
    this.addChild(this.bodyMask);

    this.bodyContainer = new Container();
    this.bodyContainer.mask = this.bodyMask;
    this.addChild(this.bodyContainer);

    // Column dividers (drawn on top of everything)
    this.columnDividers = new Graphics();
    this.addChild(this.columnDividers);

    // Create resize handles
    this.createResizeHandles();

    // Scroll interaction
    this.eventMode = 'static';
    this.on('wheel', this.onWheel, this);

    this.layout();
  }

  /**
   * Set table data
   */
  setData(data: T[]): void {
    this.originalData = data;
    // Apply current sort if any, otherwise just use data as-is
    if (this.sortState) {
      this.applySortAndRebuild();
    } else {
      this.data = data;
      this.rebuildRows();
    }
  }

  /**
   * Set selected row by ID
   */
  setSelected(id: string | undefined): void {
    this.selectedId = id;
    this.updateRowHighlights();
  }

  /**
   * Get selected item
   */
  getSelected(): T | undefined {
    return this.data.find(item => item.id === this.selectedId);
  }

  private createHeader(): void {
    const headerStyle = new TextStyle({
      fontFamily: FONTS.family,
      fontSize: FONTS.small,
      fill: COLORS.text,
      fontWeight: 'bold',
    });

    let xOffset = SPACING.sm;
    for (let i = 0; i < this.columns.length; i++) {
      const column = this.columns[i];
      if (!column) continue;

      const text = new Text({ text: column.label, style: headerStyle });
      text.x = xOffset + SPACING.xs; // Add left padding
      text.y = (this.headerHeight - text.height) / 2;

      // Right-align if specified
      if (column.align === 'right') {
        text.x = xOffset + column.width - text.width - SPACING.sm;
      } else if (column.align === 'center') {
        text.x = xOffset + (column.width - text.width) / 2;
      }

      // Make header clickable for sorting
      text.eventMode = 'static';
      text.cursor = 'pointer';
      text.on('pointerdown', () => this.onHeaderClick(column.key));

      this.headerContainer.addChild(text);
      this.headerTexts.push(text);
      xOffset += column.width;
    }
  }

  private onHeaderClick(columnKey: string): void {
    if (this.sortState?.columnKey === columnKey) {
      // Toggle direction
      this.sortState.direction = this.sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
      // New column
      this.sortState = { columnKey, direction: 'asc' };
    }
    this.applySortAndRebuild();
  }

  private applySortAndRebuild(): void {
    if (!this.sortState) {
      this.data = [...this.originalData];
    } else {
      const { columnKey, direction } = this.sortState;
      const column = this.columns.find((c) => c.key === columnKey);

      this.data = [...this.originalData].sort((a, b) => {
        // Use sortValue function if provided, otherwise fall back to nested value
        const aVal = column?.sortValue ? column.sortValue(a) : this.getNestedValue(a, columnKey);
        const bVal = column?.sortValue ? column.sortValue(b) : this.getNestedValue(b, columnKey);

        let cmp = 0;
        if (aVal === undefined || aVal === null) {
          cmp = 1; // Nulls last
        } else if (bVal === undefined || bVal === null) {
          cmp = -1;
        } else if (typeof aVal === 'string' && typeof bVal === 'string') {
          cmp = aVal.localeCompare(bVal);
        } else if (typeof aVal === 'number' && typeof bVal === 'number') {
          cmp = aVal - bVal;
        } else {
          cmp = String(aVal).localeCompare(String(bVal));
        }

        return direction === 'asc' ? cmp : -cmp;
      });
    }

    this.rebuildRows();
    this.updateHeaderSortIndicators();
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    return path.split('.').reduce((acc: unknown, part) => {
      if (acc && typeof acc === 'object' && part in acc) {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, obj);
  }

  private updateHeaderSortIndicators(): void {
    for (let i = 0; i < this.columns.length; i++) {
      const column = this.columns[i];
      const text = this.headerTexts[i];
      if (!column || !text) continue;

      // Remove any existing sort indicator
      const baseLabel = column.label;
      let newLabel = baseLabel;

      if (this.sortState?.columnKey === column.key) {
        const indicator = this.sortState.direction === 'asc' ? ' ▲' : ' ▼';
        newLabel = baseLabel + indicator;
      }

      text.text = newLabel;
    }
  }

  private createResizeHandles(): void {
    // Create a resize handle between each column
    for (let i = 0; i < this.columns.length - 1; i++) {
      const handle = new Graphics();
      handle.eventMode = 'static';
      handle.cursor = 'col-resize';
      handle.on('pointerdown', (e) => this.onResizeStart(i, e));
      this.addChild(handle);
      this.resizeHandles.push(handle);
    }
    this.updateResizeHandlePositions();
  }

  private updateResizeHandlePositions(): void {
    let xOffset = SPACING.sm;
    for (let i = 0; i < this.resizeHandles.length; i++) {
      const handle = this.resizeHandles[i];
      const width = this.columnWidths[i] ?? 100;
      xOffset += width;

      if (handle) {
        handle.clear();
        // Invisible but larger hit area for easier grabbing
        handle.rect(xOffset - 4, 0, 8, this._height);
        handle.fill({ color: 0xffffff, alpha: 0 });
      }
    }
  }

  private onResizeStart(columnIndex: number, event: FederatedPointerEvent): void {
    this.resizing = {
      columnIndex,
      startX: event.clientX,
      startWidth: this.columnWidths[columnIndex] ?? 100,
    };

    // Add document-level event listeners for drag
    document.addEventListener('pointermove', this.boundOnResizeMove);
    document.addEventListener('pointerup', this.boundOnResizeEnd);
  }

  private onResizeMove(event: PointerEvent): void {
    if (!this.resizing) return;

    const delta = event.clientX - this.resizing.startX;
    const newWidth = Math.max(50, this.resizing.startWidth + delta); // Minimum 50px
    this.columnWidths[this.resizing.columnIndex] = newWidth;

    // Rebuild headers and rows with new widths
    this.rebuildHeader();
    this.rebuildRows();
    this.updateResizeHandlePositions();
    this.layout();
  }

  private onResizeEnd(): void {
    this.resizing = null;
    document.removeEventListener('pointermove', this.boundOnResizeMove);
    document.removeEventListener('pointerup', this.boundOnResizeEnd);
  }

  private rebuildHeader(): void {
    // Clear existing header
    this.headerContainer.removeChildren();
    this.headerTexts = [];

    const headerStyle = new TextStyle({
      fontFamily: FONTS.family,
      fontSize: FONTS.small,
      fill: COLORS.text,
      fontWeight: 'bold',
    });

    let xOffset = SPACING.sm;
    for (let i = 0; i < this.columns.length; i++) {
      const column = this.columns[i];
      const width = this.columnWidths[i] ?? 100;
      if (!column) continue;

      // Add sort indicator if needed
      let label = column.label;
      if (this.sortState?.columnKey === column.key) {
        const indicator = this.sortState.direction === 'asc' ? ' ▲' : ' ▼';
        label = column.label + indicator;
      }

      const text = new Text({ text: label, style: headerStyle });
      text.x = xOffset + SPACING.xs;
      text.y = (this.headerHeight - text.height) / 2;

      if (column.align === 'right') {
        text.x = xOffset + width - text.width - SPACING.sm;
      } else if (column.align === 'center') {
        text.x = xOffset + (width - text.width) / 2;
      }

      text.eventMode = 'static';
      text.cursor = 'pointer';
      text.on('pointerdown', () => this.onHeaderClick(column.key));

      this.headerContainer.addChild(text);
      this.headerTexts.push(text);
      xOffset += width;
    }
  }

  private rebuildRows(): void {
    // Clear existing rows
    this.bodyContainer.removeChildren();
    this.rows = [];

    const cellStyle = new TextStyle({
      fontFamily: FONTS.family,
      fontSize: FONTS.small,
      fill: COLORS.textSecondary,
    });

    for (let i = 0; i < this.data.length; i++) {
      const item = this.data[i];
      if (!item) continue;

      const row = this.createRow(item, i, cellStyle);
      this.rows.push(row);
      this.bodyContainer.addChild(row.container);
    }

    this.updateRowHighlights();
    this.scrollOffset = 0;
    this.updateScroll();
  }

  private createRow(item: T, index: number, cellStyle: TextStyle): TableRow {
    const container = new Container();
    container.y = index * this.rowHeight;

    // Background for hover/selection
    const background = new Graphics();
    container.addChild(background);

    // Make row interactive
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointerover', () => this.onRowHover(item, true));
    container.on('pointerout', () => this.onRowHover(item, false));
    container.on('pointerdown', () => this.onRowSelect(item));

    // Create cells
    const cells: Text[] = [];
    let xOffset = SPACING.sm;
    const cellPadding = SPACING.sm; // Right-side padding for truncation

    for (let i = 0; i < this.columns.length; i++) {
      const column = this.columns[i];
      const width = this.columnWidths[i] ?? 100;
      if (!column) continue;

      const value = renderCell(item, column);
      const text = new Text({ text: value, style: cellStyle });
      text.x = xOffset + SPACING.xs; // Left padding
      text.y = (this.rowHeight - text.height) / 2;

      // Truncate if too wide (account for padding on both sides)
      const maxWidth = width - cellPadding;
      if (text.width > maxWidth) {
        while (text.width > maxWidth && text.text.length > 3) {
          text.text = text.text.slice(0, -4) + '...';
        }
      }

      // Right-align if specified (with right padding)
      if (column.align === 'right') {
        text.x = xOffset + width - text.width - SPACING.xs;
      } else if (column.align === 'center') {
        text.x = xOffset + (width - text.width) / 2;
      }

      container.addChild(text);
      cells.push(text);
      xOffset += width;
    }

    // Draw initial background
    this.drawRowBackground(background, this._width, this.rowHeight, false, false);

    return { container, background, cells };
  }

  private drawRowBackground(
    graphics: Graphics,
    width: number,
    height: number,
    isHovered: boolean,
    isSelected: boolean
  ): void {
    graphics.clear();

    let color: number = COLORS.panel;
    if (isSelected) {
      color = COLORS.selected;
    } else if (isHovered) {
      color = COLORS.hover;
    }

    graphics.rect(0, 0, width, height);
    graphics.fill({ color });

    // Bottom border
    graphics.moveTo(0, height - 1);
    graphics.lineTo(width, height - 1);
    graphics.stroke({ width: 1, color: COLORS.borderDim, alpha: 0.3 });
  }

  private onRowHover(item: T, isHovered: boolean): void {
    const index = this.data.indexOf(item);
    if (index === -1) return;

    const row = this.rows[index];
    if (!row) return;

    const isSelected = item.id === this.selectedId;
    this.drawRowBackground(row.background, this._width, this.rowHeight, isHovered, isSelected);
  }

  private onRowSelect(item: T): void {
    this.selectedId = item.id;
    this.updateRowHighlights();

    if (this.onRowClick) {
      this.onRowClick(item);
    }
  }

  private updateRowHighlights(): void {
    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i];
      const item = this.data[i];
      if (!row || !item) continue;

      const isSelected = item.id === this.selectedId;
      this.drawRowBackground(row.background, this._width, this.rowHeight, false, isSelected);
    }
  }

  private onWheel(event: WheelEvent): void {
    const contentHeight = this.data.length * this.rowHeight;
    const viewHeight = this._height - this.headerHeight;
    const maxScroll = Math.max(0, contentHeight - viewHeight);

    this.scrollOffset += event.deltaY * 0.5;
    this.scrollOffset = Math.max(0, Math.min(maxScroll, this.scrollOffset));
    this.updateScroll();
  }

  private updateScroll(): void {
    this.bodyContainer.y = this.headerHeight - this.scrollOffset;
  }

  protected layout(): void {
    this.fillBackground(COLORS.panel);

    // Header background
    this.headerBg.clear();
    this.headerBg.rect(0, 0, this._width, this.headerHeight);
    this.headerBg.fill({ color: COLORS.panelHeader });
    this.headerBg.moveTo(0, this.headerHeight);
    this.headerBg.lineTo(this._width, this.headerHeight);
    this.headerBg.stroke({ width: 1, color: COLORS.border, alpha: 0.5 });

    // Draw column dividers
    if (this.columnDividers) {
      this.columnDividers.clear();
      let xOffset = SPACING.sm;
      for (let i = 0; i < this.columns.length - 1; i++) {
        const width = this.columnWidths[i] ?? 100;
        xOffset += width;

        // Vertical divider line
        this.columnDividers.moveTo(xOffset, 4);
        this.columnDividers.lineTo(xOffset, this._height - 4);
        this.columnDividers.stroke({ width: 1, color: COLORS.borderDim, alpha: 0.4 });
      }
    }

    // Update mask for body
    this.bodyMask.clear();
    this.bodyMask.rect(0, this.headerHeight, this._width, this._height - this.headerHeight);
    this.bodyMask.fill({ color: 0xffffff });

    this.updateScroll();
  }
}
