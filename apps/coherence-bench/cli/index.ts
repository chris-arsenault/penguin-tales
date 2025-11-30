#!/usr/bin/env node
/**
 * Coherence Bench CLI
 *
 * Analyze simulation coherence from exported metadata files.
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import { analyzeCoherence, validateMetadata } from '../lib/index.js';
import type { CoherenceReport } from '../lib/index.js';

const program = new Command();

program
  .name('coherence-bench')
  .description('Analyze simulation coherence from metadata exports')
  .version('0.1.0');

program
  .command('analyze')
  .description('Analyze coherence metadata and generate a report')
  .argument('<input>', 'Path to coherence metadata JSON file')
  .option('-o, --output <path>', 'Output path for report JSON')
  .option('-f, --format <format>', 'Output format: json, summary, or full', 'summary')
  .action(async (input: string, options: { output?: string; format: string }) => {
    try {
      const content = readFileSync(input, 'utf-8');
      const metadata = JSON.parse(content);

      if (!validateMetadata(metadata)) {
        console.error('Error: Invalid metadata format');
        process.exit(1);
      }

      const report = analyzeCoherence(metadata);

      if (options.format === 'json' || options.output) {
        const output = options.output || input.replace('.json', '-report.json');
        writeFileSync(output, JSON.stringify(report, null, 2));
        console.log(`Report written to: ${output}`);
      }

      if (options.format === 'summary' || options.format === 'full') {
        printSummary(report);
      }

      if (options.format === 'full') {
        printDetails(report);
      }

      // Exit with error code if critical issues found
      const errorCount = report.criticalIssues.filter(i => i.severity === 'error').length;
      if (errorCount > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate that a metadata file has the correct structure')
  .argument('<input>', 'Path to metadata JSON file')
  .action((input: string) => {
    try {
      const content = readFileSync(input, 'utf-8');
      const metadata = JSON.parse(content);

      if (validateMetadata(metadata)) {
        console.log('✓ Metadata structure is valid');
        console.log(`  Domain: ${metadata.domainId} v${metadata.domainVersion}`);
        console.log(`  Templates: ${metadata.templates.length}`);
        console.log(`  Systems: ${metadata.systems.length}`);
        console.log(`  Pressures: ${metadata.pressures.length}`);
        console.log(`  Tags: ${metadata.tagRegistry.length}`);
      } else {
        console.error('✗ Invalid metadata structure');
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

function printSummary(report: CoherenceReport): void {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  COHERENCE REPORT: ${report.domainId}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Health scores
  const scoreBar = (score: number): string => {
    const filled = Math.round(score * 20);
    const empty = 20 - filled;
    const color = score >= 0.8 ? '\x1b[32m' : score >= 0.5 ? '\x1b[33m' : '\x1b[31m';
    return `${color}${'█'.repeat(filled)}${'░'.repeat(empty)}\x1b[0m ${Math.round(score * 100)}%`;
  };

  console.log('  HEALTH SCORES');
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log(`  Overall:          ${scoreBar(report.healthScore.overall)}`);
  console.log(`  Entity Coverage:  ${scoreBar(report.healthScore.entityCoverage)}`);
  console.log(`  Tag Coherence:    ${scoreBar(report.healthScore.tagCoherence)}`);
  console.log(`  Relationship:     ${scoreBar(report.healthScore.relationshipFlow)}`);
  console.log(`  Pressure Balance: ${scoreBar(report.healthScore.pressureBalance)}`);
  console.log(`  Feedback Loops:   ${scoreBar(report.healthScore.feedbackLoops)}`);

  // Summary stats
  console.log('\n  SUMMARY');
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log(`  Entity Kinds:     ${report.entityCoverage.summary.healthyKinds}/${report.entityCoverage.summary.totalKinds} healthy`);
  console.log(`  Tags:             ${report.tagFlow.summary.healthyTags}/${report.tagFlow.summary.totalTags} healthy`);
  console.log(`  Relationships:    ${report.relationshipFlow.summary.healthyKinds}/${report.relationshipFlow.summary.totalRelationshipKinds} healthy`);
  console.log(`  Pressures:        ${report.pressureEquilibrium.summary.healthyPressures}/${report.pressureEquilibrium.summary.totalPressures} healthy`);
  console.log(`  Feedback Loops:   ${report.feedbackLoopValidation.summary.healthyLoops}/${report.feedbackLoopValidation.summary.totalLoops} healthy`);

  // Critical issues
  if (report.criticalIssues.length > 0) {
    console.log('\n  CRITICAL ISSUES');
    console.log('  ─────────────────────────────────────────────────────────────');
    for (const issue of report.criticalIssues.slice(0, 10)) {
      const icon = issue.severity === 'error' ? '\x1b[31m✗\x1b[0m' :
                   issue.severity === 'warning' ? '\x1b[33m⚠\x1b[0m' : '\x1b[34mℹ\x1b[0m';
      console.log(`  ${icon} [${issue.category}] ${issue.message}`);
    }
    if (report.criticalIssues.length > 10) {
      console.log(`  ... and ${report.criticalIssues.length - 10} more issues`);
    }
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    console.log('\n  RECOMMENDATIONS');
    console.log('  ─────────────────────────────────────────────────────────────');
    for (const rec of report.recommendations.slice(0, 5)) {
      console.log(`  → ${rec.componentId}.${rec.parameter}: ${rec.currentValue} → ${rec.recommendedValue}`);
      console.log(`    Reason: ${rec.reason}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

function printDetails(report: CoherenceReport): void {
  // Orphan tags
  if (report.tagFlow.orphanList.length > 0) {
    console.log('  ORPHAN TAGS (consumed but never produced)');
    console.log('  ─────────────────────────────────────────────────────────────');
    for (const tag of report.tagFlow.orphanList) {
      const consumers = report.tagFlow.byTag[tag]?.consumers.map(c => c.componentId).join(', ');
      console.log(`  • ${tag}`);
      console.log(`    Consumed by: ${consumers}`);
    }
    console.log('');
  }

  // Unused tags
  if (report.tagFlow.unusedList.length > 0) {
    console.log('  UNUSED TAGS (produced but never consumed)');
    console.log('  ─────────────────────────────────────────────────────────────');
    for (const tag of report.tagFlow.unusedList) {
      const producers = report.tagFlow.byTag[tag]?.producers.map(p => p.componentId).join(', ');
      console.log(`  • ${tag}`);
      console.log(`    Produced by: ${producers}`);
    }
    console.log('');
  }

  // Orphan relationships
  if (report.relationshipFlow.orphanList.length > 0) {
    console.log('  ORPHAN RELATIONSHIPS (queried but never created)');
    console.log('  ─────────────────────────────────────────────────────────────');
    for (const rel of report.relationshipFlow.orphanList) {
      const consumers = report.relationshipFlow.byKind[rel]?.consumers.map(c => c.componentId).join(', ');
      console.log(`  • ${rel}`);
      console.log(`    Queried by: ${consumers}`);
    }
    console.log('');
  }
}

program.parse();
