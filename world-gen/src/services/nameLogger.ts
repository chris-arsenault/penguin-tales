import fs from 'fs';
import path from 'path';

/**
 * Tracks and logs all entity name changes during enrichment
 * Provides uniqueness statistics and collision detection
 */
export class NameLogger {
  private nameChanges: Array<{ entityId: string; kind: string; oldName: string; newName: string; tick: number }> = [];
  private currentNames: Map<string, string[]> = new Map(); // name -> [entityId, ...]
  private logFilePath: string;

  constructor() {
    const outputDir = path.join(process.cwd(), 'output');
    this.logFilePath = path.join(outputDir, 'name_changes.log');

    // Clear previous log
    if (fs.existsSync(this.logFilePath)) {
      fs.unlinkSync(this.logFilePath);
    }

    this.writeLog(`=== Name Change Log - ${new Date().toISOString()} ===\n\n`);
  }

  /**
   * Record a name change
   */
  recordChange(entityId: string, kind: string, oldName: string, newName: string, tick: number): void {
    if (oldName === newName) return;

    // Track the change
    this.nameChanges.push({ entityId, kind, oldName, newName, tick });

    // Update current names map
    if (!this.currentNames.has(newName)) {
      this.currentNames.set(newName, []);
    }
    this.currentNames.get(newName)!.push(entityId);

    // Check for collision
    const collision = this.currentNames.get(newName)!.length > 1;
    const collisionWarning = collision ? ' ⚠️  DUPLICATE NAME!' : '';

    this.writeLog(`[Tick ${tick}] ${entityId} (${kind}): "${oldName}" → "${newName}"${collisionWarning}\n`);

    if (collision) {
      const duplicates = this.currentNames.get(newName)!;
      this.writeLog(`  ↳ Name "${newName}" now used by ${duplicates.length} entities: ${duplicates.join(', ')}\n`);
    }
  }

  /**
   * Get all names currently in use
   */
  getCurrentNames(): string[] {
    return Array.from(this.currentNames.keys());
  }

  /**
   * Get duplicate names (names used by multiple entities)
   */
  getDuplicates(): Map<string, string[]> {
    const duplicates = new Map<string, string[]>();
    this.currentNames.forEach((entityIds, name) => {
      if (entityIds.length > 1) {
        duplicates.set(name, entityIds);
      }
    });
    return duplicates;
  }

  /**
   * Get uniqueness statistics
   */
  getStats(): {
    totalChanges: number;
    uniqueNames: number;
    duplicateNames: number;
    totalEntitiesWithDuplicates: number;
    duplicateList: Array<{ name: string; count: number; entityIds: string[] }>;
  } {
    const duplicates = this.getDuplicates();
    const totalEntitiesWithDuplicates = Array.from(duplicates.values())
      .reduce((sum, ids) => sum + ids.length, 0);

    return {
      totalChanges: this.nameChanges.length,
      uniqueNames: this.currentNames.size,
      duplicateNames: duplicates.size,
      totalEntitiesWithDuplicates,
      duplicateList: Array.from(duplicates.entries()).map(([name, entityIds]) => ({
        name,
        count: entityIds.length,
        entityIds
      }))
    };
  }

  /**
   * Write final statistics report
   */
  writeFinalReport(): void {
    const stats = this.getStats();

    this.writeLog(`\n\n=== Final Name Statistics ===\n`);
    this.writeLog(`Total name changes: ${stats.totalChanges}\n`);
    this.writeLog(`Unique names generated: ${stats.uniqueNames}\n`);
    this.writeLog(`Duplicate names: ${stats.duplicateNames}\n`);
    this.writeLog(`Entities with duplicate names: ${stats.totalEntitiesWithDuplicates}\n`);
    this.writeLog(`Uniqueness rate: ${((stats.uniqueNames / (stats.uniqueNames + stats.totalEntitiesWithDuplicates - stats.duplicateNames)) * 100).toFixed(1)}%\n`);

    if (stats.duplicateNames > 0) {
      this.writeLog(`\n⚠️  DUPLICATE NAMES DETECTED:\n`);
      stats.duplicateList
        .sort((a, b) => b.count - a.count)
        .forEach(({ name, count, entityIds }) => {
          this.writeLog(`  • "${name}" used by ${count} entities: ${entityIds.join(', ')}\n`);
        });
    } else {
      this.writeLog(`\n✅ No duplicate names detected!\n`);
    }

    console.log(`\n📊 Name Change Statistics:`);
    console.log(`   Total changes: ${stats.totalChanges}`);
    console.log(`   Unique names: ${stats.uniqueNames}`);
    console.log(`   Duplicates: ${stats.duplicateNames} names used by ${stats.totalEntitiesWithDuplicates} entities`);
    console.log(`   Uniqueness: ${((stats.uniqueNames / (stats.uniqueNames + stats.totalEntitiesWithDuplicates - stats.duplicateNames)) * 100).toFixed(1)}%`);
    console.log(`   Log: ${path.relative(process.cwd(), this.logFilePath)}`);

    if (stats.duplicateNames > 0) {
      console.warn(`\n⚠️  WARNING: ${stats.duplicateNames} duplicate names found!`);
      console.warn(`   See ${path.relative(process.cwd(), this.logFilePath)} for details`);
    }
  }

  private writeLog(message: string): void {
    try {
      fs.appendFileSync(this.logFilePath, message);
    } catch (error) {
      console.warn('Failed to write to name change log:', error);
    }
  }
}
