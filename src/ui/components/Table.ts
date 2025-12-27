/**
 * Table - Data-driven table component
 * Displays entities in rows with configurable columns
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { UIComponent } from './UIComponent';
import { COLORS, SPACING, FONTS } from '../UITheme';
import { type ColumnDef, renderCell } from '../UIConfig';

export interface TableOptions<T> {
  columns: ColumnDef<T>[];
  onRowClick?: (item: T) => void;
  rowHeight?: number;
  headerHeight?: number;
}

interface TableRow {
  container: Container;
  background: Graphics;
  cells: Text[];
}

export class Table<T extends { id: string }> extends UIComponent {
  private columns: ColumnDef<T>[];
  private data: T[] = [];
  private rows: TableRow[] = [];
  private selectedId?: string;
  private onRowClick?: (item: T) => void;
  private rowHeight: number;
  private headerHeight: number;

  private headerContainer: Container;
  private headerBg: Graphics;
  private headerTexts: Text[] = [];
  private columnDividers: Graphics;
  private bodyContainer: Container;
  private bodyMask: Graphics;
  private scrollOffset = 0;

  constructor(width: number, height: number, options: TableOptions<T>) {
    super(width, height);
    this.columns = options.columns;
    this.onRowClick = options.onRowClick;
    this.rowHeight = options.rowHeight ?? SPACING.rowHeight;
    this.headerHeight = options.headerHeight ?? SPACING.rowHeight;

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

    // Scroll interaction
    this.eventMode = 'static';
    this.on('wheel', this.onWheel, this);

    this.layout();
  }

  /**
   * Set table data
   */
  setData(data: T[]): void {
    this.data = data;
    this.rebuildRows();
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

      this.headerContainer.addChild(text);
      this.headerTexts.push(text);
      xOffset += column.width;
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
    const cellPadding = SPACING.md; // Padding on each side of cell

    for (const column of this.columns) {
      const value = renderCell(item, column);
      const text = new Text({ text: value, style: cellStyle });
      text.x = xOffset + SPACING.xs; // Left padding
      text.y = (this.rowHeight - text.height) / 2;

      // Truncate if too wide (account for padding on both sides)
      const maxWidth = column.width - cellPadding;
      if (text.width > maxWidth) {
        while (text.width > maxWidth && text.text.length > 3) {
          text.text = text.text.slice(0, -4) + '...';
        }
      }

      // Right-align if specified (with right padding)
      if (column.align === 'right') {
        text.x = xOffset + column.width - text.width - cellPadding;
      } else if (column.align === 'center') {
        text.x = xOffset + (column.width - text.width) / 2;
      }

      container.addChild(text);
      cells.push(text);
      xOffset += column.width;
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
        const column = this.columns[i];
        if (!column) continue;
        xOffset += column.width;

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
