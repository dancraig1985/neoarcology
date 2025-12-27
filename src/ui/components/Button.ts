/**
 * Button - Clickable button with hover state
 */

import { Container, Graphics, Text, TextStyle, FederatedPointerEvent } from 'pixi.js';
import { COLORS, SPACING, FONTS } from '../UITheme';

export interface ButtonOptions {
  label: string;
  width?: number;
  height?: number;
  backgroundColor?: number;
  hoverColor?: number;
  textColor?: number;
  borderColor?: number;
  fontSize?: number;
  onClick?: () => void;
}

const DEFAULT_OPTIONS = {
  width: 100,
  height: SPACING.buttonHeight,
  backgroundColor: COLORS.panel,
  hoverColor: COLORS.hover,
  textColor: COLORS.text,
  borderColor: COLORS.border,
  fontSize: FONTS.body,
};

export class Button extends Container {
  private options: Required<Omit<ButtonOptions, 'onClick'>> & { onClick?: () => void };
  private background: Graphics;
  private labelText: Text;
  private isHovered = false;
  private isPressed = false;

  constructor(options: ButtonOptions) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Create background
    this.background = new Graphics();
    this.addChild(this.background);

    // Create label
    const textStyle = new TextStyle({
      fontFamily: FONTS.family,
      fontSize: this.options.fontSize,
      fill: this.options.textColor,
    });
    this.labelText = new Text({ text: this.options.label, style: textStyle });
    this.addChild(this.labelText);

    // Make interactive
    this.eventMode = 'static';
    this.cursor = 'pointer';

    // Event handlers
    this.on('pointerover', this.onPointerOver, this);
    this.on('pointerout', this.onPointerOut, this);
    this.on('pointerdown', this.onPointerDown, this);
    this.on('pointerup', this.onPointerUp, this);
    this.on('pointerupoutside', this.onPointerUpOutside, this);

    this.draw();
  }

  /**
   * Update button label
   */
  setLabel(label: string): void {
    this.labelText.text = label;
    this.centerLabel();
  }

  /**
   * Set click handler
   */
  setOnClick(handler: () => void): void {
    this.options.onClick = handler;
  }

  private draw(): void {
    const bgColor = this.isHovered ? this.options.hoverColor : this.options.backgroundColor;
    const borderAlpha = this.isPressed ? 1 : 0.8;

    this.background.clear();
    this.background.rect(0, 0, this.options.width, this.options.height);
    this.background.fill({ color: bgColor });
    this.background.stroke({
      width: SPACING.borderWidth,
      color: this.options.borderColor,
      alpha: borderAlpha,
    });

    this.centerLabel();
  }

  private centerLabel(): void {
    this.labelText.x = (this.options.width - this.labelText.width) / 2;
    this.labelText.y = (this.options.height - this.labelText.height) / 2;
  }

  private onPointerOver(_event: FederatedPointerEvent): void {
    this.isHovered = true;
    this.draw();
  }

  private onPointerOut(_event: FederatedPointerEvent): void {
    this.isHovered = false;
    this.isPressed = false;
    this.draw();
  }

  private onPointerDown(_event: FederatedPointerEvent): void {
    this.isPressed = true;
    this.draw();
  }

  private onPointerUp(_event: FederatedPointerEvent): void {
    if (this.isPressed && this.options.onClick) {
      this.options.onClick();
    }
    this.isPressed = false;
    this.draw();
  }

  private onPointerUpOutside(_event: FederatedPointerEvent): void {
    this.isPressed = false;
    this.draw();
  }
}
