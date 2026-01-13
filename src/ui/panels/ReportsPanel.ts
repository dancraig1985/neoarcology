/**
 * ReportsPanel - Displays simulation metrics and statistics
 * Shows population, economy, business, and supply chain health
 */

import { Container, Text, Graphics } from 'pixi.js';
import { Panel } from '../components/Panel';
import { COLORS, FONTS, SPACING } from '../UITheme';
import type { MetricsSnapshot, TransactionCounts } from '../../simulation/Metrics';

interface ReportSection {
  title: string;
  items: { label: string; value: string }[];
}

export class ReportsPanel extends Panel {
  private sectionsContainer: Container;
  private sections: Container[] = [];

  constructor(width: number, height: number) {
    super(width, height, {
      backgroundColor: COLORS.panel,
      borderColor: COLORS.border,
      showBorder: true,
      padding: SPACING.md,
    });

    this.sectionsContainer = new Container();
    this.sectionsContainer.x = SPACING.md;
    this.sectionsContainer.y = SPACING.md;
    this.addChild(this.sectionsContainer);
  }

  /**
   * Update the reports display with current metrics
   */
  update(snapshot: MetricsSnapshot | null, transactions: TransactionCounts): void {
    // Clear existing sections
    this.sectionsContainer.removeChildren();
    this.sections = [];

    if (!snapshot) {
      this.addPlaceholder('No data available');
      return;
    }

    // Build section data
    const reportSections: ReportSection[] = [
      {
        title: 'POPULATION',
        items: [
          { label: 'Alive', value: snapshot.population.alive.toString() },
          { label: 'Dead', value: snapshot.population.dead.toString() },
          { label: 'Employed', value: snapshot.population.employed.toString() },
          { label: 'Unemployed', value: snapshot.population.unemployed.toString() },
          { label: 'Business Owners', value: snapshot.population.businessOwners.toString() },
        ],
      },
      {
        title: 'ECONOMY',
        items: [
          { label: 'Total Credits', value: this.formatNumber(snapshot.economy.totalCredits) },
          { label: 'Agent Credits', value: this.formatNumber(snapshot.economy.agentCredits) },
          { label: 'Org Credits', value: this.formatNumber(snapshot.economy.orgCredits) },
        ],
      },
      {
        title: 'BUSINESSES',
        items: [
          { label: 'Active Orgs', value: snapshot.businesses.active.toString() },
          { label: 'Retail Shops', value: snapshot.businesses.retail.toString() },
          { label: 'Wholesalers', value: snapshot.businesses.wholesale.toString() },
        ],
      },
      {
        title: 'SUPPLY CHAIN',
        items: [
          { label: 'Factory Stock', value: this.formatNumber(snapshot.supply.factoryInventory) },
          { label: 'Shop Stock', value: this.formatNumber(snapshot.supply.shopInventory) },
          { label: 'Agent Inventory', value: this.formatNumber(snapshot.supply.agentInventory) },
          { label: 'Total Provisions', value: this.formatNumber(snapshot.supply.total) },
        ],
      },
      {
        title: 'SESSION ACTIVITY',
        items: [
          { label: 'Retail Sales', value: transactions.retailSales.toString() },
          { label: 'Wholesale Sales', value: transactions.wholesaleSales.toString() },
          { label: 'Wages Paid', value: this.formatNumber(transactions.wagesPaid) },
          { label: 'Dividends Paid', value: this.formatNumber(transactions.dividendsPaid) },
          { label: 'Deaths', value: transactions.deaths.toString() },
          { label: 'Immigrants', value: transactions.immigrants.toString() },
          { label: 'Businesses Opened', value: transactions.businessesOpened.toString() },
          { label: 'Businesses Closed', value: transactions.businessesClosed.toString() },
          { label: 'Hires', value: transactions.hires.toString() },
          { label: 'Fires', value: transactions.fires.toString() },
        ],
      },
    ];

    // Layout sections in a 2-column grid
    this.layoutSections(reportSections);
  }

  private formatNumber(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  }

  private layoutSections(sections: ReportSection[]): void {
    const sectionWidth = (this._width - SPACING.md * 3) / 2;
    const sectionSpacing = SPACING.lg;

    let col = 0;
    let row = 0;
    let maxRowHeight = 0;
    let yOffset = 0;

    for (const section of sections) {
      const sectionContainer = this.createSection(section, sectionWidth);
      sectionContainer.x = col * (sectionWidth + SPACING.md);
      sectionContainer.y = yOffset;

      this.sectionsContainer.addChild(sectionContainer);
      this.sections.push(sectionContainer);

      // Track max height in this row
      maxRowHeight = Math.max(maxRowHeight, this.getSectionHeight(section));

      // Move to next column or wrap to next row
      col++;
      if (col >= 2) {
        col = 0;
        row++;
        yOffset += maxRowHeight + sectionSpacing;
        maxRowHeight = 0;
      }
    }
  }

  private createSection(section: ReportSection, width: number): Container {
    const container = new Container();

    // Section title
    const title = new Text({
      text: section.title,
      style: {
        fontFamily: FONTS.family,
        fontSize: FONTS.body,
        fill: COLORS.border,
        fontWeight: 'bold',
      },
    });
    container.addChild(title);

    // Underline
    const underline = new Graphics();
    underline.moveTo(0, FONTS.body + 4);
    underline.lineTo(width, FONTS.body + 4);
    underline.stroke({ width: 1, color: COLORS.borderDim, alpha: 0.5 });
    container.addChild(underline);

    // Items
    let yOffset = FONTS.body + SPACING.sm + 4;
    for (const item of section.items) {
      const row = this.createRow(item.label, item.value, width);
      row.y = yOffset;
      container.addChild(row);
      yOffset += SPACING.rowHeight;
    }

    return container;
  }

  private createRow(label: string, value: string, width: number): Container {
    const container = new Container();

    // Label (left aligned)
    const labelText = new Text({
      text: label,
      style: {
        fontFamily: FONTS.family,
        fontSize: FONTS.small,
        fill: COLORS.textSecondary,
      },
    });
    container.addChild(labelText);

    // Value (right aligned)
    const valueText = new Text({
      text: value,
      style: {
        fontFamily: FONTS.family,
        fontSize: FONTS.small,
        fill: COLORS.text,
      },
    });
    valueText.x = width - valueText.width;
    container.addChild(valueText);

    return container;
  }

  private getSectionHeight(section: ReportSection): number {
    return FONTS.body + SPACING.sm + 4 + section.items.length * SPACING.rowHeight;
  }

  private addPlaceholder(message: string): void {
    const text = new Text({
      text: message,
      style: {
        fontFamily: FONTS.family,
        fontSize: FONTS.body,
        fill: COLORS.textDim,
      },
    });
    text.x = (this._width - text.width) / 2;
    text.y = (this._height - text.height) / 2;
    this.sectionsContainer.addChild(text);
  }

  /**
   * Resize the panel
   */
  resize(width: number, height: number): void {
    super.resize(width, height);
    // Re-layout will happen on next update
  }
}
