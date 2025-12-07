/**
 * ValidationEditor - Semantic/Reference Validation
 *
 * Validates the semantic coherence of world configuration:
 * - Reference integrity (do referenced entity kinds, pressures exist?)
 * - Balance analysis (pressures have sources and sinks?)
 * - Dead code detection (orphan generators not in any era?)
 * - Cross-reference consistency (tags, cultures, subtypes)
 *
 * ERRORS: Issues that will cause runtime crashes (invalid references)
 * WARNINGS: Issues that degrade story coherence (unbalanced pressures, orphans)
 *
 * Note: Structure validation (types, required fields, shapes) is handled by
 * configSchemaValidator as a hard gate in the Simulation tab before running.
 */

import React, { useMemo } from 'react';
import DependencyViewer from '../DependencyViewer';
import NamingProfileMappingViewer from '../NamingProfileMappingViewer';
import './validation.css';
import { exportAsJson, exportAsCsv, runValidations, getOverallStatus, validationRules } from './utils';
import { IssueCard } from './cards';

export default function ValidationEditor({
  schema = { entityKinds: [], relationshipKinds: [], cultures: [], tagRegistry: [] },
  eras = [],
  pressures = [],
  generators = [],
  systems = [],
  usageMap = null,
  namingData = {},
  onNavigateToGenerator,
}) {
  const validationResults = useMemo(() =>
    runValidations(schema, eras, pressures, generators, systems),
    [schema, eras, pressures, generators, systems]
  );

  // Count orphans from usageMap for summary
  const orphanCounts = useMemo(() => {
    if (!usageMap?.validation?.orphans) return { generators: 0, systems: 0, pressures: 0, total: 0 };
    const orphans = usageMap.validation.orphans;
    const generators = orphans.filter(o => o.type === 'generator').length;
    const systems = orphans.filter(o => o.type === 'system').length;
    const pressures = orphans.filter(o => o.type === 'pressure').length;
    return { generators, systems, pressures, total: generators + systems + pressures };
  }, [usageMap]);

  const overallStatus = getOverallStatus(validationResults);
  const totalIssues = validationResults.errors.length + validationResults.warnings.length;

  const statusBadgeClass = `validation-status-badge ${
    overallStatus === 'clean' ? 'validation-status-clean' :
    overallStatus === 'warning' ? 'validation-status-warning' :
    'validation-status-error'
  }`;

  const handleItemClick = (itemId) => {
    if (onNavigateToGenerator) {
      onNavigateToGenerator(itemId);
    }
  };

  // Count total affected items
  const totalAffectedItems = [...validationResults.errors, ...validationResults.warnings]
    .reduce((sum, issue) => sum + issue.affectedItems.length, 0);

  return (
    <div className="validation-container">
      <div className="validation-header">
        <div className="flex-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <h1 className="validation-title">
              Validation
              <span className={statusBadgeClass}>
                {overallStatus === 'clean' ? 'All Clear' :
                 `${totalIssues} ${totalIssues === 1 ? 'Issue' : 'Issues'}`}
              </span>
            </h1>
            <p className="validation-subtitle">
              Semantic validation: reference integrity, pressure balance, and dead code detection.
              Structure validation runs automatically as a gate before simulation.
            </p>
          </div>
          {totalIssues > 0 && (
            <div className="validation-export-row">
              <button
                className="validation-export-button"
                onClick={() => exportAsJson(validationResults)}
                title="Export validation report as JSON"
              >
                Export JSON
              </button>
              <button
                className="validation-export-button"
                onClick={() => exportAsCsv(validationResults)}
                title="Export validation report as CSV"
              >
                Export CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="validation-summary-cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="validation-summary-card">
          <div className="validation-summary-value text-danger">
            {validationResults.errors.length}
          </div>
          <div className="validation-summary-label">Errors</div>
        </div>
        <div className="validation-summary-card">
          <div className="validation-summary-value text-warning">
            {validationResults.warnings.length}
          </div>
          <div className="validation-summary-label">Warnings</div>
        </div>
        <div className="validation-summary-card">
          <div className="validation-summary-value" style={{ color: orphanCounts.total > 0 ? '#9ca3af' : '#60a5fa' }}>
            {orphanCounts.total}
          </div>
          <div className="validation-summary-label">Unused</div>
        </div>
        <div className="validation-summary-card">
          <div className="validation-summary-value" style={{ color: '#60a5fa' }}>
            {totalAffectedItems}
          </div>
          <div className="validation-summary-label">Affected Items</div>
        </div>
      </div>

      {/* Clean state */}
      {overallStatus === 'clean' && (
        <div className="validation-clean-state">
          <div className="validation-clean-icon">✓</div>
          <div className="validation-clean-title">All Validations Passed</div>
          <div className="validation-clean-message">
            Your configuration looks good. No issues detected.
          </div>
        </div>
      )}

      {/* Errors section */}
      {validationResults.errors.length > 0 && (
        <div className="validation-section">
          <div className="validation-section-header">
            <div className="validation-section-title">
              <span>❌</span>
              Errors
            </div>
            <span className="validation-section-count validation-status-error">
              {validationResults.errors.length}
            </span>
          </div>
          <div className="validation-issue-list">
            {validationResults.errors.map(error => (
              <IssueCard
                key={error.id}
                issue={error}
                onItemClick={handleItemClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Warnings section */}
      {validationResults.warnings.length > 0 && (
        <div className="validation-section">
          <div className="validation-section-header">
            <div className="validation-section-title">
              <span>⚠️</span>
              Warnings
            </div>
            <span className="validation-section-count">
              {validationResults.warnings.length}
            </span>
          </div>
          <div className="validation-issue-list">
            {validationResults.warnings.map(warning => (
              <IssueCard
                key={warning.id}
                issue={warning}
                onItemClick={handleItemClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Dependency Viewer */}
      {usageMap && (
        <div className="mb-2xl">
          <DependencyViewer usageMap={usageMap} />
        </div>
      )}

      {/* Naming Profile Mappings */}
      {Object.keys(namingData).length > 0 && (
        <div className="mb-2xl">
          <NamingProfileMappingViewer
            generators={generators}
            schema={schema}
            namingData={namingData}
          />
        </div>
      )}

      {/* Rule info */}
      <div className="validation-rule-info">
        <div className="validation-rule-title">Active Validation Rules ({Object.keys(validationRules).length})</div>
        <ul className="validation-rule-list">
          <li className="validation-rule-item">
            <span className="validation-rule-bullet text-danger">●</span>
            <strong>Format & Reference Validation:</strong> Generator shape, entity kinds, relationship kinds, pressure IDs, era references
          </li>
          <li className="validation-rule-item">
            <span className="validation-rule-bullet text-warning">●</span>
            <strong>Balance Validation:</strong> Pressure sources/sinks, orphan generators/systems
          </li>
          <li className="validation-rule-item">
            <span className="validation-rule-bullet text-warning">●</span>
            <strong>Configuration Quality:</strong> Subtypes, statuses, cultures, numeric ranges
          </li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Export validation status calculation for use by parent
 */
export function getValidationStatus(schema, eras, pressures, generators, systems) {
  const results = runValidations(
    schema || { entityKinds: [], relationshipKinds: [], cultures: [], tagRegistry: [] },
    eras || [],
    pressures || [],
    generators || [],
    systems || []
  );
  return {
    status: getOverallStatus(results),
    errorCount: results.errors.length,
    warningCount: results.warnings.length,
    totalIssues: results.errors.length + results.warnings.length,
  };
}

export { ValidationEditor };
