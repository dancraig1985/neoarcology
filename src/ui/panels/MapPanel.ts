/**
 * MapPanel - 2D visualization of the city grid
 *
 * Shows:
 * - Grid cells colored by zone type
 * - Location markers (dots)
 * - Height indicated by brightness
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Panel } from '../components/Panel';
import { COLORS, SPACING, FONTS } from '../UITheme';
import { CityGrid } from '../../generation/types';
import { Location } from '../../types';
import { ZoneConfig } from '../../config/ConfigLoader';

/**
 * Convert hex color string (#rrggbb) to number
 */
function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

export class MapPanel extends Panel {
  private mapGraphics: Graphics;
  private locationGraphics: Graphics;
  private legendContainer: Container;
  private grid: CityGrid | null = null;
  private locations: Location[] = [];
  private zones: Record<string, ZoneConfig> = {};
  private cellSize: number = 8; // Pixels per cell

  constructor(width: number, height: number) {
    super(width, height, {
      title: 'CITY MAP',
      showHeader: true,
      showBorder: true,
      showCornerAccents: true,
    });

    this.mapGraphics = new Graphics();
    this.locationGraphics = new Graphics();
    this.legendContainer = new Container();

    this.getContent().addChild(this.mapGraphics);
    this.getContent().addChild(this.locationGraphics);
    this.getContent().addChild(this.legendContainer);

    this.calculateCellSize();
  }

  /**
   * Calculate cell size to fit grid in panel
   */
  private calculateCellSize(): void {
    const contentWidth = this.getContentWidth();
    const contentHeight = this.getContentHeight();

    // Calculate cell size to fit 32x32 grid with some margin
    const margin = SPACING.sm * 2;
    const availableWidth = contentWidth - margin;
    const availableHeight = contentHeight - margin;

    // Use the smaller dimension to keep cells square
    this.cellSize = Math.floor(Math.min(availableWidth / 32, availableHeight / 32));
    this.cellSize = Math.max(4, this.cellSize); // Minimum 4 pixels per cell
  }

  /**
   * Set the city grid data
   */
  setGrid(grid: CityGrid, zones: Record<string, ZoneConfig>): void {
    this.grid = grid;
    this.zones = zones;
    this.renderMap();
    this.renderLegend();
  }

  /**
   * Set the locations to display
   */
  setLocations(locations: Location[]): void {
    this.locations = locations;
    this.renderLocations();
  }

  /**
   * Get the zone color, adjusting brightness based on height
   */
  private getZoneColor(zoneId: string, height: number, maxHeight: number): number {
    const zone = this.zones[zoneId];
    if (!zone) return COLORS.textDim;

    const baseColor = hexToNumber(zone.color);

    // Extract RGB components
    const r = (baseColor >> 16) & 0xff;
    const g = (baseColor >> 8) & 0xff;
    const b = baseColor & 0xff;

    // Adjust brightness based on height (taller = brighter)
    const heightRatio = maxHeight > 0 ? height / maxHeight : 0;
    const brightnessFactor = 0.4 + heightRatio * 0.6; // 40% to 100% brightness

    const newR = Math.floor(r * brightnessFactor);
    const newG = Math.floor(g * brightnessFactor);
    const newB = Math.floor(b * brightnessFactor);

    return (newR << 16) | (newG << 8) | newB;
  }

  /**
   * Render the zone grid
   */
  private renderMap(): void {
    this.mapGraphics.clear();

    if (!this.grid) return;

    const offsetX = SPACING.sm;
    const offsetY = SPACING.sm;

    // Find max height for brightness calculation
    let maxHeight = 1;
    for (let x = 0; x < this.grid.width; x++) {
      const col = this.grid.cells[x];
      if (!col) continue;
      for (let y = 0; y < this.grid.height; y++) {
        const cell = col[y];
        if (cell && cell.maxHeight > maxHeight) {
          maxHeight = cell.maxHeight;
        }
      }
    }

    // Draw each cell
    for (let x = 0; x < this.grid.width; x++) {
      const col = this.grid.cells[x];
      if (!col) continue;

      for (let y = 0; y < this.grid.height; y++) {
        const cell = col[y];
        if (!cell) continue;

        const color = this.getZoneColor(cell.zone, cell.maxHeight, maxHeight);

        const px = offsetX + x * this.cellSize;
        const py = offsetY + y * this.cellSize;

        this.mapGraphics.rect(px, py, this.cellSize - 1, this.cellSize - 1);
        this.mapGraphics.fill({ color });
      }
    }

    // Draw grid border
    this.mapGraphics.rect(
      offsetX - 1,
      offsetY - 1,
      this.grid.width * this.cellSize + 2,
      this.grid.height * this.cellSize + 2
    );
    this.mapGraphics.stroke({ width: 1, color: COLORS.borderDim });
  }

  /**
   * Render location markers
   */
  private renderLocations(): void {
    this.locationGraphics.clear();

    if (!this.grid) return;

    const offsetX = SPACING.sm;
    const offsetY = SPACING.sm;
    const markerRadius = Math.max(2, this.cellSize / 3);

    for (const loc of this.locations) {
      // Center of the cell
      const cx = offsetX + loc.x * this.cellSize + this.cellSize / 2;
      const cy = offsetY + loc.y * this.cellSize + this.cellSize / 2;

      // Choose marker color based on location type
      let markerColor: number = COLORS.text;
      if (loc.tags.includes('wholesale')) {
        markerColor = COLORS.textWarning; // Yellow for factories
      } else if (loc.tags.includes('retail')) {
        markerColor = COLORS.textInfo; // Cyan for shops
      } else if (loc.tags.includes('residential')) {
        markerColor = COLORS.textSecondary; // Gray for residential
      }

      // Draw marker dot
      this.locationGraphics.circle(cx, cy, markerRadius);
      this.locationGraphics.fill({ color: markerColor });

      // Small border for visibility
      this.locationGraphics.circle(cx, cy, markerRadius);
      this.locationGraphics.stroke({ width: 1, color: COLORS.background });
    }
  }

  /**
   * Render the zone legend
   */
  private renderLegend(): void {
    // Clear existing legend
    this.legendContainer.removeChildren();

    if (Object.keys(this.zones).length === 0) return;

    const legendStyle = new TextStyle({
      fontFamily: FONTS.family,
      fontSize: FONTS.small,
      fill: COLORS.textSecondary,
    });

    const titleStyle = new TextStyle({
      fontFamily: FONTS.family,
      fontSize: FONTS.small,
      fill: COLORS.text,
      fontWeight: 'bold',
    });

    // Position legend to the right of the map
    const mapWidth = 32 * this.cellSize + SPACING.sm * 2;
    const legendX = mapWidth + SPACING.md;
    let legendY = SPACING.sm;

    // Legend title
    const title = new Text({ text: 'ZONES', style: titleStyle });
    title.x = legendX;
    title.y = legendY;
    this.legendContainer.addChild(title);
    legendY += 20;

    // Zone entries
    const swatchSize = 12;
    const lineHeight = 18;

    for (const [, zone] of Object.entries(this.zones)) {
      const graphics = new Graphics();

      // Color swatch
      graphics.rect(legendX, legendY, swatchSize, swatchSize);
      graphics.fill({ color: hexToNumber(zone.color) });
      graphics.stroke({ width: 1, color: COLORS.borderDim });
      this.legendContainer.addChild(graphics);

      // Zone name
      const label = new Text({ text: zone.name, style: legendStyle });
      label.x = legendX + swatchSize + SPACING.xs;
      label.y = legendY - 1;
      this.legendContainer.addChild(label);

      legendY += lineHeight;
    }

    // Location markers legend
    legendY += SPACING.sm;

    const markersTitle = new Text({ text: 'LOCATIONS', style: titleStyle });
    markersTitle.x = legendX;
    markersTitle.y = legendY;
    this.legendContainer.addChild(markersTitle);
    legendY += 20;

    const markerTypes: { color: number; label: string }[] = [
      { color: COLORS.textWarning, label: 'Factory' },
      { color: COLORS.textInfo, label: 'Retail' },
      { color: COLORS.text, label: 'Other' },
    ];

    for (const { color, label } of markerTypes) {
      const graphics = new Graphics();
      graphics.circle(legendX + swatchSize / 2, legendY + swatchSize / 2, swatchSize / 2 - 1);
      graphics.fill({ color });
      this.legendContainer.addChild(graphics);

      const markerLabel = new Text({ text: label, style: legendStyle });
      markerLabel.x = legendX + swatchSize + SPACING.xs;
      markerLabel.y = legendY - 1;
      this.legendContainer.addChild(markerLabel);

      legendY += lineHeight;
    }
  }

  /**
   * Handle resize
   */
  resize(width: number, height: number): void {
    this.setSize(width, height);
    this.calculateCellSize();
    this.renderMap();
    this.renderLocations();
    this.renderLegend();
  }
}
