export class LoreValidator {
    loreProvider;
    constructor(loreProvider) {
        this.loreProvider = loreProvider;
    }
    validateEntity(entity, text) {
        const warnings = [];
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
    validateLocation(location, discoveryContext) {
        const warnings = [];
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
        // Note: Domain lore provider doesn't track known locations for validation
        // This is acceptable as the validator is mainly for LLM output quality
        // Check description has lore cues
        if (location.description && !this.containsLoreCue(location.description)) {
            warnings.push('Location description missing lore-specific elements');
        }
        return { valid: warnings.length === 0, warnings };
    }
    containsLoreCue(text) {
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
//# sourceMappingURL=loreValidator.js.map