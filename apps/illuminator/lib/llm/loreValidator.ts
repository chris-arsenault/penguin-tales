import { HardState } from '../core/worldTypes';
import { DomainLoreProvider } from '../llm/types';

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
}

export class LoreValidator {
  private loreProvider: DomainLoreProvider;

  constructor(loreProvider: DomainLoreProvider) {
    this.loreProvider = loreProvider;
  }

  validateEntity(entity: HardState, text?: string): ValidationResult {
    const warnings: string[] = [];

    // Names should roughly follow two-part pattern with separator
    if (entity.name && !/[ -]/.test(entity.name)) {
      warnings.push('Name may not include earned-name separator (space or hyphen).');
    }

    // Flag if description lacks any cultural cues
    if (text && !this.containsLoreCue(text)) {
      warnings.push('Description missing obvious lore cues.');
    }

    // Lightweight tech vs magic balance check
    if (entity.kind === 'abilities') {
      const magicNotes = this.loreProvider.getMagicSystemNotes();
      const techNotes = this.loreProvider.getTechnologyNotes();

      const hasMagicCue = magicNotes.some(note => text?.toLowerCase().includes('magic'));
      const hasTechCue = techNotes.some(note => text?.toLowerCase().includes('harpoon') || text?.toLowerCase().includes('tech'));

      if (!hasMagicCue && !hasTechCue) {
        warnings.push('Ability lacks clear magic/tech framing.');
      }
    }

    return { valid: warnings.length === 0, warnings };
  }

  validateLocation(location: HardState, discoveryContext?: any): ValidationResult {
    const warnings: string[] = [];

    // Check if location name uses lore-appropriate geographic terms (from provider or defaults)
    const geoTerms = this.loreProvider.getGeographicTerms?.() || [];
    if (geoTerms.length > 0) {
      const hasGeoTerm = geoTerms.some(term => location.name.toLowerCase().includes(term));
      if (!hasGeoTerm && location.subtype === 'geographic_feature') {
        warnings.push('Geographic feature name lacks typical terrain terminology');
      }
    }

    // Check for mysterious/mystical locations (from provider or defaults)
    const mysticalTerms = this.loreProvider.getMysticalTerms?.() || [];
    if (mysticalTerms.length > 0) {
      const hasMysticalCue = mysticalTerms.some(term => location.name.toLowerCase().includes(term));
      if (location.subtype === 'anomaly' && !hasMysticalCue) {
        warnings.push('Anomaly name lacks mystical framing');
      }
    }

    // Note: Domain lore provider doesn't track known locations for validation
    // This is acceptable as the validator is mainly for LLM output quality

    // Check description has lore cues
    if (location.description && !this.containsLoreCue(location.description)) {
      warnings.push('Location description missing lore-specific elements');
    }

    return { valid: warnings.length === 0, warnings };
  }

  private containsLoreCue(text: string): boolean {
    // Get lore cues from provider, or skip validation if not provided
    const cues = this.loreProvider.getLoreCues?.() || [];
    if (cues.length === 0) {
      return true; // Skip validation if domain doesn't provide lore cues
    }

    return cues.some(cue => text.toLowerCase().includes(cue));
  }
}
