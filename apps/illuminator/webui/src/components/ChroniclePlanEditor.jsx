/**
 * ChroniclePlanEditor - Review chronicle plans before expansion
 *
 * Displays the structured plan from Step 1 and lets the user:
 * - Review plan elements (entities, plot, sections)
 * - Regenerate the plan if needed
 * - Approve the plan to start section expansion
 *
 * See CHRONICLE_DESIGN.md for architecture documentation.
 */

import { useMemo } from 'react';

function resolveName(map, id) {
  if (!id) return '';
  return map?.get(id)?.name || id;
}

function resolveEvent(map, id) {
  if (!id) return '';
  return map?.get(id)?.headline || id;
}

function PlanHeader({ plan }) {
  return (
    <div
      style={{
        padding: '16px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        marginBottom: '16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Plan Title</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>{plan.title}</div>
        </div>
        <span
          style={{
            fontSize: '10px',
            padding: '4px 8px',
            background: plan.format === 'document' ? '#059669' : 'var(--accent-primary)',
            color: 'white',
            borderRadius: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {plan.format}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
        {plan.theme && (
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            <strong>Theme:</strong> {plan.theme}
          </span>
        )}
        {plan.tone && (
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            <strong>Tone:</strong> {plan.tone}
          </span>
        )}
        {plan.scope?.timeframe && (
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            <strong>Timeframe:</strong> {plan.scope.timeframe}
          </span>
        )}
      </div>
    </div>
  );
}

function PlanScope({ plan }) {
  if (!plan.scope?.notes && !plan.scope?.timeframe) return null;

  return (
    <div
      style={{
        padding: '16px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        marginBottom: '16px',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Scope</div>
      {plan.scope?.timeframe && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
          <strong>Timeframe:</strong> {plan.scope.timeframe}
        </div>
      )}
      {plan.scope?.notes && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          <strong>Notes:</strong> {plan.scope.notes}
        </div>
      )}
    </div>
  );
}

function PlotSummary({ plan }) {
  const plot = plan.plot;
  if (!plot) return null;

  const beats = plot.normalizedBeats || [];
  return (
    <div
      style={{
        padding: '16px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        marginBottom: '16px',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
        Structure ({plot.type})
      </div>
      {beats.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No structure beats defined.</div>
      ) : (
        <ol style={{ margin: '0 0 0 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {beats.map((beat, idx) => (
            <li key={`${beat.description}-${idx}`}>{beat.description}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

function EntityRoleList({ plan, entityMap }) {
  if (!plan.entityRoles || plan.entityRoles.length === 0) return null;

  return (
    <div
      style={{
        padding: '16px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        marginBottom: '16px',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Entities</div>
      {plan.entityRoles.map((role) => (
        <div
          key={role.entityId}
          style={{
            padding: '10px 12px',
            borderRadius: '6px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            marginBottom: '8px',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
            {resolveName(entityMap, role.entityId)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            <strong>Role:</strong> {role.role}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            <strong>Contribution:</strong> {role.contribution}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionCard({ section, index, format, entityMap, eventMap }) {
  const entities = section.entityIds?.map((id) => resolveName(entityMap, id)) || [];
  const events = section.eventIds?.map((id) => resolveEvent(eventMap, id)) || [];

  return (
    <div
      style={{
        padding: '16px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        marginBottom: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '14px', fontWeight: 600 }}>
          Section {index + 1}: {section.name}
        </div>
        {section.optional && (
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-muted)',
            }}
          >
            optional
          </span>
        )}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
        <strong>Purpose:</strong> {section.purpose}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
        <strong>Goal:</strong> {section.goal}
      </div>
      {section.wordCountTarget && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          <strong>Word Target:</strong> {section.wordCountTarget}
        </div>
      )}
      {format === 'story' && (
        <>
          {section.emotionalArc && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              <strong>Emotional Arc:</strong> {section.emotionalArc}
            </div>
          )}
          {section.requiredElements && section.requiredElements.length > 0 && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
              <strong>Required Elements:</strong> {section.requiredElements.join(', ')}
            </div>
          )}
          {section.proseNotes && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
              <strong>Prose Notes:</strong> {section.proseNotes}
            </div>
          )}
        </>
      )}
      {format === 'document' && section.contentGuidance && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          <strong>Content Guidance:</strong> {section.contentGuidance}
        </div>
      )}
      {entities.length > 0 && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          <strong>Entities:</strong> {entities.join(', ')}
        </div>
      )}
      {events.length > 0 && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          <strong>Events:</strong> {events.join(', ')}
        </div>
      )}
    </div>
  );
}

function SectionsList({ plan, entityMap, eventMap }) {
  if (!plan.sections || plan.sections.length === 0) return null;

  return (
    <div>
      <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Sections</div>
      {plan.sections.map((section, index) => (
        <SectionCard
          key={section.id}
          section={section}
          index={index}
          format={plan.format}
          entityMap={entityMap}
          eventMap={eventMap}
        />
      ))}
    </div>
  );
}

export default function ChroniclePlanEditor({
  plan,
  entityMap,
  eventMap,
  onRegenerate,
  onApprove,
  isGenerating = false,
}) {
  const sectionCount = plan.sections?.length || 0;

  const eventStats = useMemo(() => {
    const eventIds = new Set();
    plan.sections?.forEach((section) => {
      section.eventIds?.forEach((id) => eventIds.add(id));
    });
    return eventIds.size;
  }, [plan.sections]);

  return (
    <div style={{ maxWidth: '900px' }}>
      <PlanHeader plan={plan} />
      <PlanScope plan={plan} />
      <PlotSummary plan={plan} />
      <EntityRoleList plan={plan} entityMap={entityMap} />

      <div
        style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
          }}
        >
          <strong>Sections:</strong> {sectionCount}
        </div>
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
          }}
        >
          <strong>Referenced Events:</strong> {eventStats}
        </div>
      </div>

      <SectionsList plan={plan} entityMap={entityMap} eventMap={eventMap} />

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          marginTop: '24px',
        }}
      >
        <button
          onClick={onRegenerate}
          disabled={isGenerating}
          className="illuminator-button"
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            opacity: isGenerating ? 0.6 : 1,
            cursor: isGenerating ? 'not-allowed' : 'pointer',
          }}
        >
          Regenerate Plan
        </button>
        <button
          onClick={onApprove}
          disabled={isGenerating}
          className="illuminator-button illuminator-button-primary"
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            opacity: isGenerating ? 0.6 : 1,
            cursor: isGenerating ? 'not-allowed' : 'pointer',
          }}
        >
          Approve Plan
        </button>
      </div>
    </div>
  );
}
