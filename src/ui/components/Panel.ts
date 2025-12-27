/**
 * Panel - A bordered container with optional header
 * Core building block for UI layout
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { UIComponent } from './UIComponent';
import { COLORS, SPACING, FONTS } from '../UITheme';

export interface PanelOptions {
  title?: string;
  borderColor?: number;
  backgroundColor?: number;
  showHeader?: boolean;
  showBorder?: boolean;
  showCornerAccents?: boolean;
  headerHeight?: number;
  padding?: number;
}

const DEFAULT_OPTIONS: Required<PanelOptions> = {
  title: '',
  borderColor: COLORS.border,
  backgroundColor: COLORS.panel,
  showHeader: false,
  showBorder: true,
  showCornerAccents: false,
  headerHeight: 32,
  padding: SPACING.sm,
};

export class Panel extends UIComponent {
  private options: Required<PanelOptions>;
  private headerGraphics: Graphics | null = null;
  private headerText: Text | null = null;
  private content: Container;
  private borderGraphics: Graphics;

  constructor(width: number, height: number, options: PanelOptions = {}) {
    super(width, height);
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Create border graphics
    this.borderGraphics = new Graphics();
    this.addChild(this.borderGraphics);

    // Create header if needed
    if (this.options.showHeader && this.options.title) {
      this.headerGraphics = new Graphics();
      this.addChild(this.headerGraphics);

      const textStyle = new TextStyle({
        fontFamily: FONTS.family,
        fontSize: FONTS.body,
        fill: COLORS.text,
        fontWeight: 'bold',
      });
      this.headerText = new Text({ text: this.options.title, style: textStyle });
      this.addChild(this.headerText);
    }

    // Create content container
    this.content = new Container();
    this.addChild(this.content);

    this.layout();
  }

  /**
   * Get the content container for adding children
   */
  getContent(): Container {
    return this.content;
  }

  /**
   * Get the available content width (inside padding)
   */
  getContentWidth(): number {
    return this._width - this.options.padding * 2;
  }

  /**
   * Get the available content height (inside padding, minus header)
   */
  getContentHeight(): number {
    const headerOffset = this.options.showHeader ? this.options.headerHeight : 0;
    return this._height - headerOffset - this.options.padding * 2;
  }

  /**
   * Update the title text
   */
  setTitle(title: string): void {
    if (this.headerText) {
      this.headerText.text = title;
    }
  }

  protected layout(): void {
    // Draw background
    this.fillBackground(this.options.backgroundColor);

    // Draw border
    this.borderGraphics.clear();
    if (this.options.showBorder) {
      this.drawBorder(this.borderGraphics, this.options.borderColor);
    }
    if (this.options.showCornerAccents) {
      this.drawCornerAccents(this.borderGraphics);
    }

    // Position header
    if (this.headerGraphics && this.headerText) {
      this.headerGraphics.clear();
      this.headerGraphics.rect(0, 0, this._width, this.options.headerHeight);
      this.headerGraphics.fill({ color: COLORS.panelHeader });

      // Header border bottom
      this.headerGraphics.moveTo(0, this.options.headerHeight);
      this.headerGraphics.lineTo(this._width, this.options.headerHeight);
      this.headerGraphics.stroke({ width: 1, color: this.options.borderColor, alpha: 0.5 });

      this.headerText.x = this.options.padding;
      this.headerText.y = (this.options.headerHeight - this.headerText.height) / 2;
    }

    // Position content container
    const headerOffset = this.options.showHeader ? this.options.headerHeight : 0;
    this.content.x = this.options.padding;
    this.content.y = headerOffset + this.options.padding;
  }
}
