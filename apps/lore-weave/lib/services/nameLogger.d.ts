/**
 * Tracks and logs all entity name changes during enrichment
 * Provides uniqueness statistics and collision detection
 */
export declare class NameLogger {
    private nameChanges;
    private currentNames;
    private logFilePath;
    constructor();
    /**
     * Record a name change
     */
    recordChange(entityId: string, kind: string, oldName: string, newName: string, tick: number): void;
    /**
     * Get all names currently in use
     */
    getCurrentNames(): string[];
    /**
     * Get duplicate names (names used by multiple entities)
     */
    getDuplicates(): Map<string, string[]>;
    /**
     * Get uniqueness statistics
     */
    getStats(): {
        totalChanges: number;
        uniqueNames: number;
        duplicateNames: number;
        totalEntitiesWithDuplicates: number;
        duplicateList: Array<{
            name: string;
            count: number;
            entityIds: string[];
        }>;
    };
    /**
     * Write final statistics report
     */
    writeFinalReport(): void;
    private writeLog;
}
//# sourceMappingURL=nameLogger.d.ts.map