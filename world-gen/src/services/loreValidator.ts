import { HardState } from '../types/worldTypes';
import { LoreIndex } from '../types/lore';

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
}

export class LoreValidator {
  private loreIndex: LoreIndex;

  constructor(loreIndex: LoreIndex) {
    this.loreIndex = loreIndex;
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
      const hasMagicCue = this.loreIndex.magicNotes.some(note => text?.toLowerCase().includes('magic'));
      const hasTechCue = this.loreIndex.techNotes.some(note => text?.toLowerCase().includes('harpoon') || text?.toLowerCase().includes('tech'));

      if (!hasMagicCue && !hasTechCue) {
        warnings.push('Ability lacks clear magic/tech framing.');
      }
    }

    return { valid: warnings.length === 0, warnings };
  }

  validateLocation(location: HardState, discoveryContext?: any): ValidationResult {
    const warnings: string[] = [];

    // Check if location name uses lore-appropriate geographic terms
    const geoTerms = ['shelf', 'ridge', 'hollow', 'stack', 'pools', 'reach', 'pass', 'peak', 'bridge', 'valley', 'cavern', 'grotto', 'ledge', 'terrace'];
    const hasGeoTerm = geoTerms.some(term => location.name.toLowerCase().includes(term));
    if (!hasGeoTerm && location.subtype === 'geographic_feature') {
      warnings.push('Geographic feature name lacks typical terrain terminology');
    }

    // Check for mysterious/mystical locations
    const mysticalTerms = ['glow', 'aurora', 'singing', 'echo', 'frozen', 'ancient', 'crystal', 'mirror', 'shadow', 'lost'];
    const hasMysticalCue = mysticalTerms.some(term => location.name.toLowerCase().includes(term));
    if (location.subtype === 'anomaly' && !hasMysticalCue) {
      warnings.push('Anomaly name lacks mystical framing');
    }

    // Validate against established canon (avoid duplicate names)
    const isDuplicate = this.loreIndex.geography.knownLocations.some(
      known => known.name.toLowerCase() === location.name.toLowerCase()
    );
    if (isDuplicate) {
      warnings.push(`Location name conflicts with established location in lore`);
    }

    // Check description has lore cues
    if (location.description && !this.containsLoreCue(location.description)) {
      warnings.push('Location description missing lore-specific elements');
    }

    return { valid: warnings.length === 0, warnings };
  }

  private containsLoreCue(text: string): boolean {
    const cues = [
      'aurora',
      'ice',
      'berg',
      'fissure',
      'current',
      'frost',
      'glow',
      'krill',
      'coin',
      'sing'
    ];

    return cues.some(cue => text.toLowerCase().includes(cue));
  }
}
