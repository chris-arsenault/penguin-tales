import { HardState } from '../types/worldTypes';
import { DomainLoreProvider } from '../types/domainLore';
export interface ValidationResult {
    valid: boolean;
    warnings: string[];
}
export declare class LoreValidator {
    private loreProvider;
    constructor(loreProvider: DomainLoreProvider);
    validateEntity(entity: HardState, text?: string): ValidationResult;
    validateLocation(location: HardState, discoveryContext?: any): ValidationResult;
    private containsLoreCue;
}
//# sourceMappingURL=loreValidator.d.ts.map