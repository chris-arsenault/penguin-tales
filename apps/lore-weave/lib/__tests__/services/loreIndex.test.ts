import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadLoreIndex } from '../../services/loreIndex';
import fs from 'fs';
import path from 'path';

// Mock fs module
vi.mock('fs');

describe('loadLoreIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('file loading', () => {
    it('should load and parse lore file from given path', () => {
      const mockLoreText = 'Mock lore bible content';
      vi.mocked(fs.readFileSync).mockReturnValue(mockLoreText);

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(fs.readFileSync).toHaveBeenCalledWith(
        path.resolve('/path/to/lore.txt'),
        'utf-8'
      );
      expect(result.sourceText).toBe(mockLoreText);
    });

    it('should resolve relative paths to absolute', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('content');

      loadLoreIndex('relative/path/lore.txt');

      expect(fs.readFileSync).toHaveBeenCalledWith(
        path.resolve('relative/path/lore.txt'),
        'utf-8'
      );
    });

    it('should handle file read errors gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File not found');
      });

      const result = loadLoreIndex('/nonexistent/lore.txt');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not read lore bible'),
        expect.any(Error)
      );
      expect(result.sourceText).toBe('');

      consoleWarnSpy.mockRestore();
    });

    it('should return empty sourceText on read error', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = loadLoreIndex('/forbidden/lore.txt');

      expect(result.sourceText).toBe('');
    });
  });

  describe('colonies data', () => {
    it('should return array of colonies', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(Array.isArray(result.colonies)).toBe(true);
      expect(result.colonies.length).toBeGreaterThan(0);
    });

    it('should include Aurora Stack colony', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      const aurora = result.colonies.find(c => c.name === 'Aurora Stack');
      expect(aurora).toBeDefined();
      expect(aurora?.values).toContain('commerce');
      expect(aurora?.values).toContain('tradition');
      expect(aurora?.style).toBe('orderly terraces, trade banners, sunlit face');
    });

    it('should include Nightfall Shelf colony', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      const nightfall = result.colonies.find(c => c.name === 'Nightfall Shelf');
      expect(nightfall).toBeDefined();
      expect(nightfall?.values).toContain('independence');
      expect(nightfall?.values).toContain('innovation');
    });

    it('should include all expected colonies', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      const colonyNames = result.colonies.map(c => c.name);
      expect(colonyNames).toContain('Aurora Stack');
      expect(colonyNames).toContain('Nightfall Shelf');
      expect(colonyNames).toContain('Windward Ridge');
      expect(colonyNames).toContain('The Middle Pools');
      expect(colonyNames).toContain('Echo Hollow');
    });

    it('should include colony notes where defined', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      const aurora = result.colonies.find(c => c.name === 'Aurora Stack');
      expect(aurora?.notes).toBeDefined();
      expect(aurora?.notes).toContain('practical names');
    });
  });

  describe('factions data', () => {
    it('should return array of faction names', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(Array.isArray(result.factions)).toBe(true);
      expect(result.factions.length).toBeGreaterThan(0);
    });

    it('should include expected factions', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(result.factions).toContain('Icebound Exchange');
      expect(result.factions).toContain('Midnight Claws');
      expect(result.factions).toContain('Deep Singers');
      expect(result.factions).toContain('Frost Guard');
    });
  });

  describe('naming rules', () => {
    it('should return naming rules object', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(result.namingRules).toBeDefined();
      expect(result.namingRules.patterns).toBeDefined();
      expect(result.namingRules.earnedNameRules).toBeDefined();
      expect(result.namingRules.colonyTone).toBeDefined();
    });

    it('should include naming patterns', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(Array.isArray(result.namingRules.patterns)).toBe(true);
      expect(result.namingRules.patterns.length).toBeGreaterThan(0);
      expect(result.namingRules.patterns.some(p => p.includes('Two-part names'))).toBe(true);
    });

    it('should include earned name rules', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(result.namingRules.earnedNameRules).toContain('Earned names');
    });

    it('should include colony tone guidance', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(result.namingRules.colonyTone['Aurora Stack']).toBe('practical, trade-focused, concise');
      expect(result.namingRules.colonyTone['Nightfall Shelf']).toBe('poetic, mysterious, innovative');
    });
  });

  describe('relationship patterns', () => {
    it('should return array of relationship patterns', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(Array.isArray(result.relationshipPatterns)).toBe(true);
      expect(result.relationshipPatterns.length).toBeGreaterThan(0);
    });

    it('should include cross-colony relationship rules', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(result.relationshipPatterns.some(p => p.includes('Cross-colony'))).toBe(true);
    });
  });

  describe('tech and magic notes', () => {
    it('should return technology notes', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(Array.isArray(result.techNotes)).toBe(true);
      expect(result.techNotes.length).toBeGreaterThan(0);
    });

    it('should include tech details', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(result.techNotes.some(n => n.includes('Technology is communal'))).toBe(true);
      expect(result.techNotes.some(n => n.includes('Glow Stones'))).toBe(true);
    });

    it('should return magic notes', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(Array.isArray(result.magicNotes)).toBe(true);
      expect(result.magicNotes.length).toBeGreaterThan(0);
    });

    it('should include magic system details', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(result.magicNotes.some(n => n.includes('Ice Magic'))).toBe(true);
      expect(result.magicNotes.some(n => n.includes('Old Flows'))).toBe(true);
    });
  });

  describe('tensions and canon', () => {
    it('should return array of tensions', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(Array.isArray(result.tensions)).toBe(true);
      expect(result.tensions.length).toBeGreaterThan(0);
    });

    it('should include specific tensions', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(result.tensions.some(t => t.includes('Fissure rights'))).toBe(true);
      expect(result.tensions.some(t => t.includes('Krill scarcity'))).toBe(true);
    });

    it('should return array of canon facts', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(Array.isArray(result.canon)).toBe(true);
      expect(result.canon.length).toBeGreaterThan(0);
    });

    it('should include canon facts', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(result.canon.some(c => c.includes('Two main colonies'))).toBe(true);
      expect(result.canon.some(c => c.includes('Ice magic exists'))).toBe(true);
    });

    it('should return array of legends', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(Array.isArray(result.legends)).toBe(true);
      expect(result.legends.length).toBeGreaterThan(0);
    });
  });

  describe('geography', () => {
    it('should return geography object', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(result.geography).toBeDefined();
      expect(result.geography.constraints).toBeDefined();
      expect(result.geography.knownLocations).toBeDefined();
      expect(result.geography.discoveryPrecedents).toBeDefined();
    });

    it('should include geography constraints', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(result.geography.constraints.totalArea).toBe('10 sq km of surface');
      expect(result.geography.constraints.verticalDepth).toBe(true);
      expect(result.geography.constraints.secretPassages).toBe(true);
    });

    it('should include known locations', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(Array.isArray(result.geography.knownLocations)).toBe(true);
      expect(result.geography.knownLocations.length).toBeGreaterThan(0);

      const auroraStack = result.geography.knownLocations.find(
        l => l.name === 'Aurora Stack'
      );
      expect(auroraStack).toBeDefined();
      expect(auroraStack?.type).toBe('colony');
      expect(auroraStack?.status).toBe('active');
    });

    it('should include vanished locations', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      const starfall = result.geography.knownLocations.find(
        l => l.name === 'Starfall Reach'
      );
      expect(starfall).toBeDefined();
      expect(starfall?.status).toBe('vanished');
    });

    it('should include discovery precedents', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(Array.isArray(result.geography.discoveryPrecedents)).toBe(true);
      const glowFissure = result.geography.discoveryPrecedents.find(
        d => d.location === 'Glow-Fissure'
      );
      expect(glowFissure).toBeDefined();
      expect(glowFissure?.significance).toContain('Recent discovery');
    });
  });

  describe('location themes', () => {
    it('should return location themes object', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(result.locationThemes).toBeDefined();
      expect(result.locationThemes.resources).toBeDefined();
      expect(result.locationThemes.mystical).toBeDefined();
      expect(result.locationThemes.strategic).toBeDefined();
    });

    it('should include resource themes', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(Array.isArray(result.locationThemes.resources)).toBe(true);
      expect(result.locationThemes.resources).toContain('krill blooms');
      expect(result.locationThemes.resources).toContain('fishing grounds');
    });

    it('should include mystical themes', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(Array.isArray(result.locationThemes.mystical)).toBe(true);
      expect(result.locationThemes.mystical).toContain('Glow-Fissure phenomena');
      expect(result.locationThemes.mystical).toContain('aurora convergence');
    });

    it('should include strategic themes', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('lore content');

      const result = loadLoreIndex('/path/to/lore.txt');

      expect(Array.isArray(result.locationThemes.strategic)).toBe(true);
      expect(result.locationThemes.strategic).toContain('watchtower positions');
      expect(result.locationThemes.strategic).toContain('neutral zones');
    });
  });

  describe('data consistency', () => {
    it('should always return same structure regardless of file content', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('');

      const result = loadLoreIndex('/path/to/lore.txt');

      // All expected fields should be present
      expect(result).toHaveProperty('sourceText');
      expect(result).toHaveProperty('colonies');
      expect(result).toHaveProperty('factions');
      expect(result).toHaveProperty('namingRules');
      expect(result).toHaveProperty('relationshipPatterns');
      expect(result).toHaveProperty('techNotes');
      expect(result).toHaveProperty('magicNotes');
      expect(result).toHaveProperty('tensions');
      expect(result).toHaveProperty('canon');
      expect(result).toHaveProperty('legends');
      expect(result).toHaveProperty('geography');
      expect(result).toHaveProperty('locationThemes');
    });

    it('should return hardcoded lore structure even on read error', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File not found');
      });

      const result = loadLoreIndex('/nonexistent.txt');

      // Structure should still be valid
      expect(result.colonies.length).toBeGreaterThan(0);
      expect(result.factions.length).toBeGreaterThan(0);
      expect(result.geography.knownLocations.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty path', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('content');

      const result = loadLoreIndex('');

      expect(fs.readFileSync).toHaveBeenCalledWith(path.resolve(''), 'utf-8');
      expect(result).toBeDefined();
    });

    it('should handle paths with special characters', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('content');

      const specialPath = '/path/with spaces/and-dashes/lore@file.txt';
      const result = loadLoreIndex(specialPath);

      expect(fs.readFileSync).toHaveBeenCalledWith(
        path.resolve(specialPath),
        'utf-8'
      );
      expect(result).toBeDefined();
    });

    it('should handle very large file content', () => {
      const largeLoreText = 'x'.repeat(1000000); // 1MB of text
      vi.mocked(fs.readFileSync).mockReturnValue(largeLoreText);

      const result = loadLoreIndex('/large/lore.txt');

      expect(result.sourceText).toBe(largeLoreText);
      expect(result.sourceText.length).toBe(1000000);
    });

    it('should handle unicode characters in file content', () => {
      const unicodeLore = 'Lore with 🐧 penguins and ❄️ ice';
      vi.mocked(fs.readFileSync).mockReturnValue(unicodeLore);

      const result = loadLoreIndex('/unicode/lore.txt');

      expect(result.sourceText).toBe(unicodeLore);
    });
  });
});
