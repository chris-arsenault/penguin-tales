import { GrowthTemplate, SimulationSystem } from '../types/engine';
import { TemplateMetadata, SystemMetadata } from '../types/distribution';
/**
 * Parameter override configuration structure
 */
interface ParameterOverrides {
    templates?: Record<string, {
        metadata?: Partial<TemplateMetadata>;
    }>;
    systems?: Record<string, {
        metadata?: Partial<SystemMetadata>;
    }>;
}
/**
 * Apply parameter overrides to templates
 */
export declare function applyTemplateOverrides(templates: GrowthTemplate[], overrides: ParameterOverrides): GrowthTemplate[];
/**
 * Apply parameter overrides to systems
 */
export declare function applySystemOverrides(systems: SimulationSystem[], overrides: ParameterOverrides): SimulationSystem[];
/**
 * Apply all parameter overrides to templates and systems
 */
export declare function applyParameterOverrides(templates: GrowthTemplate[], systems: SimulationSystem[], overrides: ParameterOverrides): {
    templates: GrowthTemplate[];
    systems: SimulationSystem[];
};
export {};
//# sourceMappingURL=parameterOverrides.d.ts.map