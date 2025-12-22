/**
 * PromptPreviewPanel - Shows prompt templates and how domain context is used
 *
 * Displays:
 * - System prompt that sets the tone for all generations
 * - Template previews for each enrichment type
 * - Which domain context fields are used
 * - Example prompts with actual entity data (if available)
 */

import { useState, useMemo } from 'react';

const TASK_TYPES = [
  { id: 'description', label: 'Description', icon: '📝' },
  { id: 'image', label: 'Image', icon: '🖼️' },
  { id: 'relationship', label: 'Relationship', icon: '🔗' },
  { id: 'era_narrative', label: 'Era Narrative', icon: '📜' },
];

// Which domain context fields are used by each task type
const CONTEXT_USAGE = {
  description: [
    { field: 'worldName', required: true, description: 'Used in opening sentence' },
    { field: 'worldDescription', required: true, description: 'Provides world context' },
    { field: 'canonFacts', required: true, description: 'Listed as constraints' },
    { field: 'cultureNotes', required: false, description: 'Cultural style for entity' },
  ],
  image: [
    { field: 'worldName', required: true, description: 'Setting context' },
    { field: 'geographyTraits', required: true, description: 'Environmental setting' },
    { field: 'cultureNotes', required: false, description: 'Art style from culture' },
  ],
  relationship: [
    { field: 'relationshipPatterns', required: true, description: 'World relationship dynamics' },
    { field: 'conflictPatterns', required: true, description: 'Sources of tension' },
  ],
  era_narrative: [
    { field: 'worldDescription', required: true, description: 'World context' },
    { field: 'technologyNotes', required: true, description: 'Tech flavor for era' },
    { field: 'magicNotes', required: true, description: 'Magic system rules' },
  ],
};

function buildSystemPromptPreview(domainContext) {
  return `You are a lore writer for ${domainContext.worldName || '[worldName]'}.
Your writing should be evocative and consistent with the world's established canon.
Keep responses concise but vivid. Focus on what makes each element unique.`;
}

function buildPromptPreview(taskType, domainContext, exampleEntity) {
  const entity = exampleEntity || {
    name: '[Entity Name]',
    kind: '[kind]',
    subtype: '[subtype]',
    prominence: 'recognized',
    culture: '[culture]',
    description: '[existing description]',
  };

  const cultureNote = domainContext.cultureNotes?.[entity.culture];
  const worldName = domainContext.worldName || '[worldName]';
  const worldDescription = domainContext.worldDescription || '[worldDescription]';

  switch (taskType) {
    case 'description':
      return `Write a compelling description for ${entity.name}, a ${entity.subtype} ${entity.kind} in ${worldName}.

Entity details:
- Kind: ${entity.kind}
- Subtype: ${entity.subtype}
- Prominence: ${entity.prominence}
- Culture: ${entity.culture || 'unknown'}
${cultureNote ? `- Cultural style: ${cultureNote.styleNotes}` : '- Cultural style: [not set for this culture]'}

World context:
${worldDescription}

Canon facts that must not be contradicted:
${(domainContext.canonFacts || []).length > 0
    ? domainContext.canonFacts.map((f) => `- ${f}`).join('\n')
    : '- [no canon facts defined]'}

Write 2-3 sentences that capture the essence of this ${entity.kind}.`;

    case 'image':
      return `A detailed fantasy illustration of ${entity.name}, a ${entity.subtype} ${entity.kind}.
${entity.description ? `Character/scene description: ${entity.description}` : 'Character/scene description: [will use generated description]'}
${cultureNote?.styleNotes ? `Art style: ${cultureNote.styleNotes}` : 'Art style: [not set - will use default fantasy art]'}
Setting: ${worldName} - ${(domainContext.geographyTraits || []).slice(0, 2).join(', ') || '[geographyTraits not set]'}
Mood: ${entity.prominence === 'mythic' ? 'epic and legendary' : entity.prominence === 'renowned' ? 'notable and impressive' : 'atmospheric and fitting'}`;

    case 'relationship':
      return `Describe the relationship dynamics involving ${entity.name}.

Entity: ${entity.name} (${entity.subtype} ${entity.kind})
Prominence: ${entity.prominence}

Known relationship patterns in this world:
${(domainContext.relationshipPatterns || []).length > 0
    ? domainContext.relationshipPatterns.map((p) => `- ${p}`).join('\n')
    : '- [no relationship patterns defined]'}

Conflict patterns:
${(domainContext.conflictPatterns || []).length > 0
    ? domainContext.conflictPatterns.map((p) => `- ${p}`).join('\n')
    : '- [no conflict patterns defined]'}`;

    case 'era_narrative':
      return `Write a narrative summary for the era/event: ${entity.name}

Type: ${entity.subtype}
Description: ${entity.description || '[will use generated description]'}

World context: ${worldDescription}

Technology notes:
${(domainContext.technologyNotes || []).length > 0
    ? domainContext.technologyNotes.map((n) => `- ${n}`).join('\n')
    : '- [no technology notes defined]'}

Magic system notes:
${(domainContext.magicNotes || []).length > 0
    ? domainContext.magicNotes.map((n) => `- ${n}`).join('\n')
    : '- [no magic notes defined]'}`;

    default:
      return '[Unknown task type]';
  }
}

function ContextFieldStatus({ field, required, description, value }) {
  const hasValue = Array.isArray(value)
    ? value.length > 0
    : typeof value === 'object'
      ? Object.keys(value || {}).length > 0
      : Boolean(value);

  return (
    <div className="illuminator-context-field">
      <span className={`illuminator-context-field-status ${hasValue ? 'set' : 'missing'}`}>
        {hasValue ? '✓' : required ? '✗' : '○'}
      </span>
      <span className="illuminator-context-field-name">{field}</span>
      <span className="illuminator-context-field-desc">{description}</span>
      {!hasValue && required && (
        <span className="illuminator-context-field-warning">required</span>
      )}
    </div>
  );
}

export default function PromptPreviewPanel({ domainContext, worldData, worldSchema }) {
  const [selectedType, setSelectedType] = useState('description');
  const [selectedEntityId, setSelectedEntityId] = useState('');

  // Get example entities for preview
  const exampleEntities = useMemo(() => {
    if (!worldData || worldData.length === 0) return [];
    // Get a few entities of different kinds
    const byKind = {};
    for (const entity of worldData) {
      if (!byKind[entity.kind]) {
        byKind[entity.kind] = entity;
      }
    }
    return Object.values(byKind).slice(0, 10);
  }, [worldData]);

  const selectedEntity = useMemo(() => {
    if (!selectedEntityId) return exampleEntities[0] || null;
    return worldData?.find((e) => e.id === selectedEntityId) || null;
  }, [selectedEntityId, worldData, exampleEntities]);

  const systemPrompt = buildSystemPromptPreview(domainContext);
  const taskPrompt = buildPromptPreview(selectedType, domainContext, selectedEntity);
  const contextUsage = CONTEXT_USAGE[selectedType] || [];

  return (
    <div>
      {/* System Prompt */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">System Prompt</h2>
          <span className="illuminator-card-subtitle">
            Sets the tone and role for all text generation
          </span>
        </div>
        <pre className="illuminator-prompt-preview">{systemPrompt}</pre>
      </div>

      {/* Task Type Selector */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Task Prompts</h2>
          <span className="illuminator-card-subtitle">
            Templates used for each enrichment type
          </span>
        </div>

        <div className="illuminator-prompt-tabs">
          {TASK_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              className={`illuminator-prompt-tab ${selectedType === type.id ? 'active' : ''}`}
            >
              <span>{type.icon}</span>
              <span>{type.label}</span>
            </button>
          ))}
        </div>

        {/* Context Fields Used */}
        <div className="illuminator-context-usage">
          <h3 className="illuminator-context-usage-title">Domain Context Fields Used</h3>
          <div className="illuminator-context-fields">
            {contextUsage.map(({ field, required, description }) => (
              <ContextFieldStatus
                key={field}
                field={field}
                required={required}
                description={description}
                value={domainContext?.[field]}
              />
            ))}
          </div>
        </div>

        {/* Entity Selector */}
        {exampleEntities.length > 0 && (
          <div className="illuminator-form-group" style={{ marginTop: '16px' }}>
            <label className="illuminator-label">Preview with entity:</label>
            <select
              value={selectedEntityId}
              onChange={(e) => setSelectedEntityId(e.target.value)}
              className="illuminator-select"
            >
              <option value="">
                {exampleEntities[0]?.name || 'Example'} ({exampleEntities[0]?.kind})
              </option>
              {exampleEntities.slice(1).map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name} ({entity.kind}/{entity.subtype})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Prompt Preview */}
        <div style={{ marginTop: '16px' }}>
          <h3 className="illuminator-label">Generated Prompt:</h3>
          <pre className="illuminator-prompt-preview illuminator-prompt-preview-large">
            {taskPrompt}
          </pre>
        </div>
      </div>

      {/* Missing Context Warning */}
      {contextUsage.some(({ field, required }) => {
        const value = domainContext?.[field];
        const hasValue = Array.isArray(value)
          ? value.length > 0
          : typeof value === 'object'
            ? Object.keys(value || {}).length > 0
            : Boolean(value);
        return required && !hasValue;
      }) && (
        <div className="illuminator-prompt-warning">
          <span className="illuminator-prompt-warning-icon">⚠</span>
          <span>
            Some required context fields are not set. The prompts will use placeholder text
            until you configure them in the <strong>Context</strong> tab.
          </span>
        </div>
      )}
    </div>
  );
}
