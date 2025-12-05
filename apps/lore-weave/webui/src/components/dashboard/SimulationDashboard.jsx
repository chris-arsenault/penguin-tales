/**
 * SimulationDashboard - Real-time visualization of simulation progress
 */

import React from 'react';
import ProgressOverview from './ProgressOverview';
import EpochTimeline from './EpochTimeline';
import PopulationMetrics from './PopulationMetrics';
import TemplateUsage from './TemplateUsage';
import FinalDiagnostics from './FinalDiagnostics';
import LogStream from './LogStream';

export default function SimulationDashboard({ simState, onClearLogs }) {
  const {
    status,
    progress,
    currentEpoch,
    epochStats,
    populationReport,
    templateUsage,
    systemHealth,
    entityBreakdown,
    catalystStats,
    relationshipBreakdown,
    notableEntities,
    sampleHistory,
    logs
  } = simState;

  // Extract pressures from latest epoch stats
  const pressures = epochStats.length > 0 ? epochStats[epochStats.length - 1].pressures : null;

  // Show final diagnostics when simulation is complete or we have diagnostic data
  const showFinalDiagnostics = status === 'complete' ||
    entityBreakdown || catalystStats || relationshipBreakdown || notableEntities || sampleHistory;

  return (
    <div className="lw-dashboard">
      {/* Overview Bar */}
      <ProgressOverview progress={progress} status={status} />

      {/* Main Content Grid */}
      <div className="lw-main-content">
        {/* Left Panel */}
        <EpochTimeline
          epochStats={epochStats}
          currentEpoch={currentEpoch}
          pressures={pressures}
        />

        {/* Right Panel - stacked */}
        <div className="lw-flex-col lw-gap-lg">
          <PopulationMetrics
            populationReport={populationReport}
            epochStats={epochStats}
          />
          <TemplateUsage
            templateUsage={templateUsage}
            systemHealth={systemHealth}
          />
        </div>
      </div>

      {/* Final Diagnostics (shown after completion) */}
      {showFinalDiagnostics && (
        <FinalDiagnostics
          entityBreakdown={entityBreakdown}
          catalystStats={catalystStats}
          relationshipBreakdown={relationshipBreakdown}
          notableEntities={notableEntities}
          sampleHistory={sampleHistory}
        />
      )}

      {/* Log Stream */}
      <LogStream logs={logs} onClear={onClearLogs} />
    </div>
  );
}
