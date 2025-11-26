#!/usr/bin/env node

/**
 * Analyze which relationship types are causing violations
 */

import * as fs from 'fs';
import * as path from 'path';

const statsPath = path.resolve(__dirname, '../../world-gen/output/stats.json');

if (!fs.existsSync(statsPath)) {
  console.error('No stats.json found. Run world-gen first.');
  process.exit(1);
}

const stats = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
const violations = stats.performanceStats?.protectedRelationshipViolations;

if (!violations) {
  console.error('No violation data found in stats.json');
  process.exit(1);
}

console.log('PROTECTED RELATIONSHIP VIOLATIONS ANALYSIS');
console.log('==========================================\n');

console.log(`Total violations: ${violations.totalViolations}`);
console.log(`Violation rate: ${violations.violationRate.toFixed(2)}/tick`);
console.log(`Average strength: ${violations.avgStrength.toFixed(3)}\n`);

console.log('Violations by relationship kind:\n');

// Sort by violation count
const sorted = Object.entries(violations.violationsByKind)
  .sort(([, a], [, b]) => (b as number) - (a as number));

sorted.forEach(([kind, count]) => {
  const percentage = ((count as number) / violations.totalViolations * 100).toFixed(1);
  console.log(`  ${kind.padEnd(20)} ${count.toString().padStart(4)}  (${percentage}%)`);
});

// Identify top offenders
const topOffenders = sorted.slice(0, 3);
const topOffenderCount = topOffenders.reduce((sum, [, count]) => sum + (count as number), 0);
const topOffenderPct = (topOffenderCount / violations.totalViolations * 100).toFixed(1);

console.log(`\n📊 Top 3 offenders account for ${topOffenderPct}% of violations:`);
topOffenders.forEach(([kind, count], i) => {
  console.log(`  ${i + 1}. ${kind}: ${count}`);
});

console.log('\n💡 RECOMMENDATIONS:\n');

topOffenders.forEach(([kind]) => {
  console.log(`For "${kind}" relationships:`);

  if (kind.includes('resident') || kind.includes('member') || kind.includes('leader')) {
    console.log('  → These are STRUCTURAL relationships (should never decay)');
    console.log('  → Add to protected list in relationship_decay.ts');
    console.log('  → Exempt from decay entirely\n');
  } else if (kind.includes('practitioner') || kind.includes('discoverer')) {
    console.log('  → These are ACHIEVEMENT relationships');
    console.log('  → Set decay floor to 0.9 or 1.0');
    console.log('  → Or exempt from decay\n');
  } else if (kind.includes('manifests') || kind.includes('slumbers') || kind.includes('originated')) {
    console.log('  → These are PERMANENT FACTS (should NEVER change)');
    console.log('  → Exempt from all decay and culling');
    console.log('  → Strength should always be 1.0\n');
  } else {
    console.log('  → Review if this should be protected');
    console.log('  → Consider adjusting decay parameters\n');
  }
});

console.log('LIKELY ROOT CAUSE:');
console.log('  The relationship_decay and relationship_culling systems');
console.log('  are applying to relationships they shouldn\'t touch.');
console.log('  No amount of parameter tuning can fix this -');
console.log('  you need to modify the systems themselves.\n');
