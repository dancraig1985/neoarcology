/**
 * UIComponent - Base class for all UI components
 * Provides common layout, resize, and update patterns
 */

import { Container, Graphics } from 'pixi.js';
import { COLORS, SPACING } from '../UITheme';

export abstract class UIComponent extends Container {
  protected _width: number;
  protected _height: number;
  protected background: Graphics;

  constructor(width: number, height: number) {
    super();
    this._width = width;
    this._height = height;
    this.background = new Graphics();
    this.addChild(this.background);
  }

  /**
   * Get component width
   */
  get componentWidth(): number {
    return this._width;
  }

  /**
   * Get component height
   */
  get componentHeight(): number {
    return this._height;
  }

  /**
   * Resize component and trigger re-layout
   */
  resize(width: number, height: number): void {
    this._width = width;
    this._height = height;
    this.layout();
  }

  /**
   * Subclasses implement to position children after resize
   */
  protected abstract layout(): void;

  /**
   * Draw a border rectangle
   */
  protected drawBorder(
    graphics: Graphics,
    color: number = COLORS.border,
    thickness: number = SPACING.borderWidth,
    alpha: number = 0.8
  ): void {
    graphics.rect(0, 0, this._width, this._height);
    graphics.stroke({ width: thickness, color, alpha });
  }

  /**
   * Draw cyberpunk-style corner accents (L-shaped corners)
   */
  protected drawCornerAccents(
    graphics: Graphics,
    color: number = COLORS.accent,
    size: number = SPACING.cornerSize
  ): void {
    const w = this._width;
    const h = this._height;

    // Top-left
    graphics.moveTo(0, size);
    graphics.lineTo(0, 0);
    graphics.lineTo(size, 0);
    graphics.stroke({ width: 2, color });

    // Top-right
    graphics.moveTo(w - size, 0);
    graphics.lineTo(w, 0);
    graphics.lineTo(w, size);
    graphics.stroke({ width: 2, color });

    // Bottom-left
    graphics.moveTo(0, h - size);
    graphics.lineTo(0, h);
    graphics.lineTo(size, h);
    graphics.stroke({ width: 2, color });

    // Bottom-right
    graphics.moveTo(w - size, h);
    graphics.lineTo(w, h);
    graphics.lineTo(w, h - size);
    graphics.stroke({ width: 2, color });
  }

  /**
   * Fill background with solid color
   */
  protected fillBackground(color: number = COLORS.panel, alpha: number = 1): void {
    this.background.clear();
    this.background.rect(0, 0, this._width, this._height);
    this.background.fill({ color, alpha });
  }
}
