/**
 * TemplateUsage - Shows template usage stats and system health
 */

import React from 'react';

export default function TemplateUsage({ templateUsage, systemHealth }) {
  if (!templateUsage) {
    return (
      <div className="lw-panel">
        <div className="lw-panel-header">
          <div className="lw-panel-title">
            <span>🔧</span>
            Template Usage
          </div>
        </div>
        <div className="lw-panel-content">
          <div className="lw-empty-state">
            <span className="lw-empty-icon">⚙️</span>
            <span>Template stats will appear here</span>
          </div>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...templateUsage.usage.map(t => t.count), 1);

  return (
    <div className="lw-panel">
      <div className="lw-panel-header">
        <div className="lw-panel-title">
          <span>🔧</span>
          Template Usage
        </div>
        <span style={{ fontSize: '12px', color: 'var(--lw-text-muted)' }}>
          {templateUsage.uniqueTemplatesUsed}/{templateUsage.totalTemplates} used
        </span>
      </div>
      <div className="lw-panel-content">
        {/* System health indicator */}
        {systemHealth && (
          <div className="lw-health-indicator" style={{ marginBottom: '12px' }}>
            <div
              className={`lw-health-dot ${systemHealth.status}`}
              style={{
                backgroundColor: systemHealth.status === 'stable' ? 'var(--lw-success)' :
                                systemHealth.status === 'functional' ? 'var(--lw-warning)' : 'var(--lw-danger)'
              }}
            />
            <span className="lw-health-text">
              System Health: {(systemHealth.populationHealth * 100).toFixed(0)}%
            </span>
            <span style={{ fontSize: '12px', color: 'var(--lw-text-muted)', marginLeft: 'auto' }}>
              {systemHealth.status}
            </span>
          </div>
        )}

        {/* Top templates */}
        <div className="lw-template-list">
          {templateUsage.usage.slice(0, 8).map(template => {
            const fillColor = template.status === 'saturated' ? 'var(--lw-danger)' :
                             template.status === 'warning' ? 'var(--lw-warning)' : 'var(--lw-accent)';
            return (
              <div key={template.templateId} className="lw-template-item">
                <span className="lw-template-name" title={template.templateId}>
                  {template.templateId}
                </span>
                <div className="lw-template-bar">
                  <div
                    className="lw-template-fill"
                    style={{
                      width: `${(template.count / maxCount) * 100}%`,
                      backgroundColor: fillColor
                    }}
                  />
                </div>
                <span className="lw-template-count">{template.count}×</span>
              </div>
            );
          })}
        </div>

        {/* Unused templates warning */}
        {templateUsage.unusedTemplates.length > 0 && (
          <div className="lw-info-box" style={{ marginTop: '12px', color: 'var(--lw-warning)', backgroundColor: 'rgba(245, 158, 11, 0.15)' }}>
            {templateUsage.unusedTemplates.length} templates never used
          </div>
        )}
      </div>
    </div>
  );
}
