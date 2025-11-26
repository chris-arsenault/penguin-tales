import { Graph } from '../types/engine';
import { HardState } from '../types/worldTypes';
/**
 * Validation result for a single check
 */
export interface ValidationResult {
    name: string;
    passed: boolean;
    failureCount: number;
    details: string;
    failedEntities?: HardState[];
}
/**
 * Complete validation report
 */
export interface ValidationReport {
    totalChecks: number;
    passed: number;
    failed: number;
    results: ValidationResult[];
}
/**
 * Validate that all entities have at least one connection (incoming or outgoing)
 */
export declare function validateConnectedEntities(graph: Graph): ValidationResult;
/**
 * Validate that entities have required structural relationships
 * Uses domain schema to determine requirements (no hardcoded entity kinds!)
 */
export declare function validateNPCStructure(graph: Graph): ValidationResult;
/**
 * Validate that all relationship references point to existing entities
 */
export declare function validateRelationshipIntegrity(graph: Graph): ValidationResult;
/**
 * Validate that entity links match actual relationships
 */
export declare function validateLinkSync(graph: Graph): ValidationResult;
/**
 * Validate that entities have lore enrichment (if LLM is enabled)
 */
export declare function validateLorePresence(graph: Graph): ValidationResult;
/**
 * Run all validators and generate a complete report
 */
export declare function validateWorld(graph: Graph): ValidationReport;
//# sourceMappingURL=validators.d.ts.map