import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NameLogger } from '../../services/nameLogger';
import fs from 'fs';
import path from 'path';

// Mock fs module
vi.mock('fs');

describe('NameLogger', () => {
  let logger: NameLogger;
  const mockLogPath = path.join(process.cwd(), 'output', 'name_changes.log');

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fs.existsSync to return false (no previous log)
    vi.mocked(fs.existsSync).mockReturnValue(false);

    // Mock fs.appendFileSync
    vi.mocked(fs.appendFileSync).mockImplementation(() => {});

    // Mock fs.unlinkSync
    vi.mocked(fs.unlinkSync).mockImplementation(() => {});

    logger = new NameLogger();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with empty tracking structures', () => {
      expect(logger.getCurrentNames()).toEqual([]);
      expect(logger.getDuplicates().size).toBe(0);
    });

    it('should create log file with header', () => {
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        mockLogPath,
        expect.stringContaining('=== Name Change Log')
      );
    });

    it('should delete existing log file if present', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      new NameLogger();

      expect(fs.unlinkSync).toHaveBeenCalledWith(mockLogPath);
    });

    it('should not delete log file if not present', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      new NameLogger();

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('recordChange', () => {
    it('should record a name change', () => {
      logger.recordChange('entity1', 'npc', 'Old Name', 'New Name', 10);

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        mockLogPath,
        expect.stringContaining('[Tick 10]')
      );
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        mockLogPath,
        expect.stringContaining('entity1')
      );
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        mockLogPath,
        expect.stringContaining('"Old Name" → "New Name"')
      );
    });

    it('should not record when old name equals new name', () => {
      const callsBefore = vi.mocked(fs.appendFileSync).mock.calls.length;
      logger.recordChange('entity1', 'npc', 'Same Name', 'Same Name', 10);
      const callsAfter = vi.mocked(fs.appendFileSync).mock.calls.length;

      expect(callsAfter).toBe(callsBefore);
    });

    it('should update current names map', () => {
      logger.recordChange('entity1', 'npc', 'Old Name', 'New Name', 10);

      const currentNames = logger.getCurrentNames();
      expect(currentNames).toContain('New Name');
      expect(currentNames).toHaveLength(1);
    });

    it('should detect and warn about duplicate names', () => {
      logger.recordChange('entity1', 'npc', 'Old Name 1', 'Duplicate Name', 10);
      logger.recordChange('entity2', 'npc', 'Old Name 2', 'Duplicate Name', 11);

      const lastCall = vi.mocked(fs.appendFileSync).mock.calls[
        vi.mocked(fs.appendFileSync).mock.calls.length - 2
      ];
      expect(lastCall[1]).toContain('⚠️  DUPLICATE NAME!');
    });

    it('should log duplicate entity list when collision occurs', () => {
      logger.recordChange('entity1', 'npc', 'Old Name 1', 'Duplicate Name', 10);
      logger.recordChange('entity2', 'npc', 'Old Name 2', 'Duplicate Name', 11);

      const lastCall = vi.mocked(fs.appendFileSync).mock.calls[
        vi.mocked(fs.appendFileSync).mock.calls.length - 1
      ];
      expect(lastCall[1]).toContain('entity1, entity2');
    });

    it('should handle multiple entities with same name', () => {
      logger.recordChange('entity1', 'npc', 'Old Name 1', 'Same', 10);
      logger.recordChange('entity2', 'npc', 'Old Name 2', 'Same', 11);
      logger.recordChange('entity3', 'npc', 'Old Name 3', 'Same', 12);

      const duplicates = logger.getDuplicates();
      expect(duplicates.get('Same')).toEqual(['entity1', 'entity2', 'entity3']);
    });

    it('should handle file write errors gracefully', () => {
      vi.mocked(fs.appendFileSync).mockImplementation(() => {
        throw new Error('Write error');
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => {
        logger.recordChange('entity1', 'npc', 'Old', 'New', 10);
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to write to name change log:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getCurrentNames', () => {
    it('should return empty array when no names recorded', () => {
      expect(logger.getCurrentNames()).toEqual([]);
    });

    it('should return all unique names', () => {
      logger.recordChange('entity1', 'npc', 'Old1', 'Name1', 10);
      logger.recordChange('entity2', 'npc', 'Old2', 'Name2', 11);
      logger.recordChange('entity3', 'npc', 'Old3', 'Name3', 12);

      const names = logger.getCurrentNames();
      expect(names).toHaveLength(3);
      expect(names).toContain('Name1');
      expect(names).toContain('Name2');
      expect(names).toContain('Name3');
    });

    it('should not include duplicate names multiple times', () => {
      logger.recordChange('entity1', 'npc', 'Old1', 'Same', 10);
      logger.recordChange('entity2', 'npc', 'Old2', 'Same', 11);

      const names = logger.getCurrentNames();
      expect(names).toHaveLength(1);
      expect(names).toContain('Same');
    });
  });

  describe('getDuplicates', () => {
    it('should return empty map when no duplicates exist', () => {
      logger.recordChange('entity1', 'npc', 'Old1', 'Name1', 10);
      logger.recordChange('entity2', 'npc', 'Old2', 'Name2', 11);

      expect(logger.getDuplicates().size).toBe(0);
    });

    it('should return map with duplicate names', () => {
      logger.recordChange('entity1', 'npc', 'Old1', 'Dup', 10);
      logger.recordChange('entity2', 'npc', 'Old2', 'Dup', 11);

      const duplicates = logger.getDuplicates();
      expect(duplicates.size).toBe(1);
      expect(duplicates.get('Dup')).toEqual(['entity1', 'entity2']);
    });

    it('should not include unique names', () => {
      logger.recordChange('entity1', 'npc', 'Old1', 'Unique', 10);
      logger.recordChange('entity2', 'npc', 'Old2', 'Dup', 11);
      logger.recordChange('entity3', 'npc', 'Old3', 'Dup', 12);

      const duplicates = logger.getDuplicates();
      expect(duplicates.size).toBe(1);
      expect(duplicates.has('Unique')).toBe(false);
    });

    it('should handle multiple duplicate groups', () => {
      logger.recordChange('entity1', 'npc', 'Old1', 'Dup1', 10);
      logger.recordChange('entity2', 'npc', 'Old2', 'Dup1', 11);
      logger.recordChange('entity3', 'npc', 'Old3', 'Dup2', 12);
      logger.recordChange('entity4', 'npc', 'Old4', 'Dup2', 13);

      const duplicates = logger.getDuplicates();
      expect(duplicates.size).toBe(2);
      expect(duplicates.get('Dup1')).toEqual(['entity1', 'entity2']);
      expect(duplicates.get('Dup2')).toEqual(['entity3', 'entity4']);
    });
  });

  describe('getStats', () => {
    it('should return zero stats for empty logger', () => {
      const stats = logger.getStats();

      expect(stats.totalChanges).toBe(0);
      expect(stats.uniqueNames).toBe(0);
      expect(stats.duplicateNames).toBe(0);
      expect(stats.totalEntitiesWithDuplicates).toBe(0);
      expect(stats.duplicateList).toEqual([]);
    });

    it('should count total changes', () => {
      logger.recordChange('entity1', 'npc', 'Old1', 'Name1', 10);
      logger.recordChange('entity2', 'npc', 'Old2', 'Name2', 11);
      logger.recordChange('entity3', 'npc', 'Old3', 'Name3', 12);

      const stats = logger.getStats();
      expect(stats.totalChanges).toBe(3);
    });

    it('should count unique names', () => {
      logger.recordChange('entity1', 'npc', 'Old1', 'Name1', 10);
      logger.recordChange('entity2', 'npc', 'Old2', 'Name2', 11);

      const stats = logger.getStats();
      expect(stats.uniqueNames).toBe(2);
    });

    it('should count duplicate names', () => {
      logger.recordChange('entity1', 'npc', 'Old1', 'Dup', 10);
      logger.recordChange('entity2', 'npc', 'Old2', 'Dup', 11);

      const stats = logger.getStats();
      expect(stats.duplicateNames).toBe(1);
    });

    it('should count total entities with duplicates', () => {
      logger.recordChange('entity1', 'npc', 'Old1', 'Dup', 10);
      logger.recordChange('entity2', 'npc', 'Old2', 'Dup', 11);
      logger.recordChange('entity3', 'npc', 'Old3', 'Dup', 12);

      const stats = logger.getStats();
      expect(stats.totalEntitiesWithDuplicates).toBe(3);
    });

    it('should provide detailed duplicate list', () => {
      logger.recordChange('entity1', 'npc', 'Old1', 'Dup', 10);
      logger.recordChange('entity2', 'npc', 'Old2', 'Dup', 11);

      const stats = logger.getStats();
      expect(stats.duplicateList).toHaveLength(1);
      expect(stats.duplicateList[0]).toEqual({
        name: 'Dup',
        count: 2,
        entityIds: ['entity1', 'entity2']
      });
    });
  });

  describe('writeFinalReport', () => {
    it('should write statistics to log file', () => {
      logger.recordChange('entity1', 'npc', 'Old1', 'Name1', 10);
      logger.recordChange('entity2', 'npc', 'Old2', 'Name2', 11);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.writeFinalReport();
      consoleSpy.mockRestore();

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        mockLogPath,
        expect.stringContaining('=== Final Name Statistics ===')
      );
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        mockLogPath,
        expect.stringContaining('Total name changes: 2')
      );
    });

    it('should write uniqueness rate', () => {
      logger.recordChange('entity1', 'npc', 'Old1', 'Name1', 10);
      logger.recordChange('entity2', 'npc', 'Old2', 'Name2', 11);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.writeFinalReport();
      consoleSpy.mockRestore();

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        mockLogPath,
        expect.stringContaining('Uniqueness rate: 100.0%')
      );
    });

    it('should log duplicate warning when duplicates exist', () => {
      logger.recordChange('entity1', 'npc', 'Old1', 'Dup', 10);
      logger.recordChange('entity2', 'npc', 'Old2', 'Dup', 11);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.writeFinalReport();
      consoleSpy.mockRestore();

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        mockLogPath,
        expect.stringContaining('⚠️  DUPLICATE NAMES DETECTED:')
      );
    });

    it('should write success message when no duplicates', () => {
      logger.recordChange('entity1', 'npc', 'Old1', 'Name1', 10);
      logger.recordChange('entity2', 'npc', 'Old2', 'Name2', 11);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.writeFinalReport();
      consoleSpy.mockRestore();

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        mockLogPath,
        expect.stringContaining('✅ No duplicate names detected!')
      );
    });

    it('should log stats to console', () => {
      logger.recordChange('entity1', 'npc', 'Old1', 'Name1', 10);
      logger.recordChange('entity2', 'npc', 'Old2', 'Name2', 11);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.writeFinalReport();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Name Change Statistics'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Total changes: 2'));

      consoleSpy.mockRestore();
    });

    it('should warn to console when duplicates exist', () => {
      logger.recordChange('entity1', 'npc', 'Old1', 'Dup', 10);
      logger.recordChange('entity2', 'npc', 'Old2', 'Dup', 11);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logger.writeFinalReport();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('WARNING: 1 duplicate names found!')
      );

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('should sort duplicates by count in descending order', () => {
      logger.recordChange('entity1', 'npc', 'Old1', 'Dup1', 10);
      logger.recordChange('entity2', 'npc', 'Old2', 'Dup1', 11);
      logger.recordChange('entity3', 'npc', 'Old3', 'Dup2', 12);
      logger.recordChange('entity4', 'npc', 'Old4', 'Dup2', 13);
      logger.recordChange('entity5', 'npc', 'Old5', 'Dup2', 14);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.writeFinalReport();
      consoleSpy.mockRestore();

      // Check the log file calls to verify sorting
      const calls = vi.mocked(fs.appendFileSync).mock.calls;
      const logText = calls.map(call => call[1]).join('');

      // Verify Dup2 appears before Dup1 in the log
      const dup2Index = logText.indexOf('"Dup2" used by 3 entities');
      const dup1Index = logText.indexOf('"Dup1" used by 2 entities');

      expect(dup2Index).toBeGreaterThan(0);
      expect(dup1Index).toBeGreaterThan(0);
      expect(dup2Index).toBeLessThan(dup1Index);
    });
  });

  describe('edge cases', () => {
    it('should handle empty strings for names', () => {
      logger.recordChange('entity1', 'npc', '', 'New Name', 10);

      expect(logger.getCurrentNames()).toContain('New Name');
    });

    it('should handle special characters in names', () => {
      logger.recordChange('entity1', 'npc', 'Old', 'Name with @#$%', 10);

      expect(logger.getCurrentNames()).toContain('Name with @#$%');
    });

    it('should handle very long entity IDs', () => {
      const longId = 'entity_' + 'x'.repeat(1000);
      logger.recordChange(longId, 'npc', 'Old', 'New', 10);

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        mockLogPath,
        expect.stringContaining(longId)
      );
    });

    it('should handle zero tick', () => {
      logger.recordChange('entity1', 'npc', 'Old', 'New', 0);

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        mockLogPath,
        expect.stringContaining('[Tick 0]')
      );
    });

    it('should handle negative tick (edge case)', () => {
      logger.recordChange('entity1', 'npc', 'Old', 'New', -5);

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        mockLogPath,
        expect.stringContaining('[Tick -5]')
      );
    });

    it('should calculate uniqueness rate correctly with zero entities', () => {
      const stats = logger.getStats();
      expect(stats.uniqueNames).toBe(0);
      // Uniqueness calculation should not divide by zero
      expect(() => logger.writeFinalReport()).not.toThrow();
    });
  });
});
