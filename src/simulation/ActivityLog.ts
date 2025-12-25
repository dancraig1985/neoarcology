/**
 * ActivityLog - Logs all significant simulation events
 * Provides a history of what happened for debugging and narrative
 */

export type LogLevel = 'info' | 'warning' | 'critical';

export interface LogEntry {
  phase: number;
  level: LogLevel;
  category: string;
  message: string;
  entityId?: string;
  entityName?: string;
  data?: Record<string, unknown>;
}

/**
 * ActivityLog singleton for the simulation
 */
class ActivityLogImpl {
  private entries: LogEntry[] = [];
  private maxEntries = 1000; // Keep last N entries

  /**
   * Log an event
   */
  log(
    phase: number,
    level: LogLevel,
    category: string,
    message: string,
    entityId?: string,
    entityName?: string,
    data?: Record<string, unknown>
  ): void {
    const entry: LogEntry = {
      phase,
      level,
      category,
      message,
      entityId,
      entityName,
      data,
    };

    this.entries.push(entry);

    // Trim if too many entries
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    // Console output with formatting
    const prefix = entityName ? `[${entityName}]` : '';
    const levelIcon = level === 'critical' ? '💀' : level === 'warning' ? '⚠️' : '•';
    console.log(`${levelIcon} Phase ${phase} ${prefix} ${message}`);
  }

  /**
   * Log info level event
   */
  info(
    phase: number,
    category: string,
    message: string,
    entityId?: string,
    entityName?: string,
    data?: Record<string, unknown>
  ): void {
    this.log(phase, 'info', category, message, entityId, entityName, data);
  }

  /**
   * Log warning level event
   */
  warning(
    phase: number,
    category: string,
    message: string,
    entityId?: string,
    entityName?: string,
    data?: Record<string, unknown>
  ): void {
    this.log(phase, 'warning', category, message, entityId, entityName, data);
  }

  /**
   * Log critical level event
   */
  critical(
    phase: number,
    category: string,
    message: string,
    entityId?: string,
    entityName?: string,
    data?: Record<string, unknown>
  ): void {
    this.log(phase, 'critical', category, message, entityId, entityName, data);
  }

  /**
   * Get all entries
   */
  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  /**
   * Get entries for a specific entity
   */
  getEntriesForEntity(entityId: string): LogEntry[] {
    return this.entries.filter((e) => e.entityId === entityId);
  }

  /**
   * Get entries by category
   */
  getEntriesByCategory(category: string): LogEntry[] {
    return this.entries.filter((e) => e.category === category);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
  }
}

// Export singleton instance
export const ActivityLog = new ActivityLogImpl();
