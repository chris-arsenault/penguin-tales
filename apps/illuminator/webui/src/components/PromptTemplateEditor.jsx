/**
 * PromptTemplateEditor - Combined template editing and preview
 *
 * Features:
 * - Per-kind prompt customization
 * - Structured mode (edit individual sections) vs Advanced mode (full template)
 * - Live preview with entity data from graph
 * - Entity context built dynamically (relationships, peers, age)
 */

import { useState, useMemo, useCallback } from 'react';
import {
  createDefaultPromptTemplates,
  mergeWithDefaults,
  getEffectiveTemplate,
  buildDescriptionPrompt,
  buildImagePrompt,
  expandTemplate,
} from '../lib/promptTemplates';
import { buildEntityIndex, buildRelationshipIndex } from '../lib/worldData';

const TASK_TYPES = [
  { id: 'description', label: 'Description', icon: '📝' },
  { id: 'image', label: 'Image', icon: '🖼️' },
  { id: 'relationship', label: 'Relationship', icon: '🔗' },
  { id: 'era_narrative', label: 'Era Narrative', icon: '📜' },
];

const DESCRIPTION_SECTIONS = [
  { key: 'instructions', label: 'Instructions', description: 'What to emphasize for this kind' },
  { key: 'tone', label: 'Tone', description: 'Writing style guidance' },
  { key: 'constraints', label: 'Constraints', description: 'What to avoid or required elements' },
  { key: 'outputFormat', label: 'Output Format', description: 'Length and format guidance' },
];

const IMAGE_SECTIONS = [
  { key: 'style', label: 'Art Style', description: 'Visual style and aesthetic' },
  { key: 'composition', label: 'Composition', description: 'Shot type, framing, layout' },
  { key: 'mood', label: 'Mood', description: 'Emotional tone based on prominence' },
  { key: 'avoidElements', label: 'Avoid', description: 'What NOT to include' },
];

const NOTABLE_PROMINENCE = new Set(['mythic', 'renowned', 'recognized']);

// Calculate entity age based on creation tick relative to simulation progress
function calculateEntityAge(entity, simulationMetadata) {
  const currentTick = simulationMetadata?.currentTick || 100;
  const age = currentTick - (entity?.createdAt || 0);
  const ageRatio = age / Math.max(currentTick, 1);

  if (ageRatio > 0.8) return 'ancient';
  if (ageRatio > 0.6) return 'established';
  if (ageRatio > 0.3) return 'mature';
  if (ageRatio > 0.1) return 'recent';
  return 'new';
}

// Resolve relationships with target entity names
function resolveRelationships(entity, entityById, relationshipsByEntity) {
  const relationships = [];

  const links = relationshipsByEntity.get(entity?.id) || [];
  if (links.length === 0) return relationships;

  for (const link of links) {
    const targetId = link.src === entity.id ? link.dst : link.src;
    const target = entityById.get(targetId);
    if (target) {
      relationships.push({
        kind: link.kind,
        targetName: target.name,
        targetKind: target.kind,
        targetSubtype: target.subtype,
        strength: link.strength,
        mutual: link.src !== entity.id,
      });
    }
  }

  return relationships;
}

// Find notable entities of the same culture
function findCulturalPeers(entity, prominentByCulture) {
  if (!entity?.culture) return [];
  const peers = prominentByCulture.get(entity.culture) || [];
  return peers
    .filter((peer) => peer.id !== entity.id)
    .slice(0, 5)
    .map((peer) => peer.name);
}

// Find faction members for faction entities
function findFactionMembers(entity, entityById, relationshipsByEntity) {
  if (entity?.kind !== 'faction') return [];
  const members = [];

  const links = relationshipsByEntity.get(entity.id) || [];
  for (const link of links) {
    if (link.kind !== 'member_of' || link.dst !== entity.id) continue;
    const member = entityById.get(link.src);
    if (member && ['mythic', 'renowned'].includes(member.prominence)) {
      members.push(member.name);
    }
  }

  return members.slice(0, 5);
}

// Build full prompt context from world context and entity
function buildPromptContext(
  worldContext,
  entity,
  prominentByCulture,
  entityById,
  relationshipsByEntity,
  simulationMetadata
) {
  const relationships = resolveRelationships(entity, entityById, relationshipsByEntity);
  const culturalPeers = findCulturalPeers(entity, prominentByCulture);
  const factionMembers = findFactionMembers(entity, entityById, relationshipsByEntity);

  return {
    world: {
      name: worldContext?.name || '[World Name]',
      description: worldContext?.description || '[World description not set]',
      canonFacts: worldContext?.canonFacts || [],
      tone: worldContext?.tone || '',
    },
    entity: {
      entity: {
        id: entity?.id || '',
        name: entity?.name || '[Entity Name]',
        kind: entity?.kind || '[kind]',
        subtype: entity?.subtype || '[subtype]',
        prominence: entity?.prominence || 'recognized',
        culture: entity?.culture || '',
        status: entity?.status || 'active',
        description: entity?.description || '',
        tags: entity?.tags || {},
      },
      relationships,
      era: {
        name: simulationMetadata?.currentEra?.name || '',
        description: simulationMetadata?.currentEra?.description,
      },
      entityAge: calculateEntityAge(entity, simulationMetadata),
      culturalPeers: culturalPeers.length > 0 ? culturalPeers : undefined,
      factionMembers: factionMembers.length > 0 ? factionMembers : undefined,
    },
  };
}

function TemplateSection({ section, value, onChange, disabled }) {
  return (
    <div className="illuminator-template-section">
      <div className="illuminator-template-section-header">
        <label className="illuminator-label">{section.label}</label>
        <span className="illuminator-template-section-hint">{section.description}</span>
      </div>
      <textarea
        className="illuminator-template-textarea"
        value={value || ''}
        onChange={(e) => onChange(section.key, e.target.value)}
        disabled={disabled}
        rows={3}
      />
    </div>
  );
}

function KindSelector({ kinds, selectedKind, onSelectKind }) {
  return (
    <div className="illuminator-kind-selector">
      <button
        onClick={() => onSelectKind(null)}
        className={`illuminator-kind-button ${selectedKind === null ? 'active' : ''}`}
      >
        Default
      </button>
      {kinds.map((kind) => (
        <button
          key={kind.kind}
          onClick={() => onSelectKind(kind.kind)}
          className={`illuminator-kind-button ${selectedKind === kind.kind ? 'active' : ''}`}
        >
          {kind.description || kind.kind}
        </button>
      ))}
    </div>
  );
}

export default function PromptTemplateEditor({
  templates: externalTemplates,
  onTemplatesChange,
  worldContext,
  worldData,
  worldSchema,
  simulationMetadata,
}) {
  const [selectedType, setSelectedType] = useState('description');
  const [selectedKind, setSelectedKind] = useState(null);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState('');

  // Merge external templates with defaults
  const templates = useMemo(
    () => mergeWithDefaults(externalTemplates),
    [externalTemplates]
  );

  // Get entity kinds from schema
  const entityKinds = useMemo(() => {
    return worldSchema?.entityKinds || [];
  }, [worldSchema]);

  const entities = useMemo(() => worldData?.hardState || [], [worldData]);
  const entityById = useMemo(() => buildEntityIndex(entities), [entities]);
  const relationshipsByEntity = useMemo(
    () => buildRelationshipIndex(worldData?.relationships || []),
    [worldData?.relationships]
  );
  const prominentByCulture = useMemo(() => {
    const map = new Map();
    for (const entity of entities) {
      if (!entity.culture) continue;
      if (!NOTABLE_PROMINENCE.has(entity.prominence)) continue;
      const entry = { id: entity.id, name: entity.name };
      const existing = map.get(entity.culture);
      if (existing) {
        existing.push(entry);
      } else {
        map.set(entity.culture, [entry]);
      }
    }
    return map;
  }, [entities]);

  // Get example entities for preview
  const exampleEntities = useMemo(() => {
    if (!entities || entities.length === 0) return [];
    const byKind = {};
    for (const entity of entities) {
      if (!byKind[entity.kind]) {
        byKind[entity.kind] = entity;
      }
    }
    return Object.values(byKind).slice(0, 15);
  }, [entities]);

  const selectedEntity = useMemo(() => {
    if (!selectedEntityId) return exampleEntities[0] || null;
    return entities.find((e) => e.id === selectedEntityId) || null;
  }, [selectedEntityId, entities, exampleEntities]);

  const selectedRelationships = useMemo(() => {
    if (!selectedEntity) return [];
    return resolveRelationships(selectedEntity, entityById, relationshipsByEntity);
  }, [selectedEntity, entityById, relationshipsByEntity]);

  // Get current template being edited
  const currentTemplate = useMemo(() => {
    if (selectedType === 'relationship') {
      return templates.defaults.relationship;
    }
    if (selectedType === 'era_narrative') {
      return templates.defaults.eraNarrative;
    }

    // For description/image, get effective template for selected kind
    const taskType = selectedType === 'description' ? 'description' : 'image';

    if (selectedKind === null) {
      return templates.defaults[taskType];
    }

    // Get kind override or default
    const kindOverride = templates.byKind[selectedKind]?.[taskType];
    if (kindOverride) {
      return { ...templates.defaults[taskType], ...kindOverride };
    }
    return templates.defaults[taskType];
  }, [templates, selectedType, selectedKind]);

  // Check if current kind has overrides
  const hasKindOverride = useMemo(() => {
    if (selectedKind === null || selectedType === 'relationship' || selectedType === 'era_narrative') {
      return false;
    }
    const taskType = selectedType === 'description' ? 'description' : 'image';
    return !!templates.byKind[selectedKind]?.[taskType];
  }, [templates, selectedType, selectedKind]);

  // Build live preview
  const preview = useMemo(() => {
    const context = buildPromptContext(
      worldContext,
      selectedEntity,
      prominentByCulture,
      entityById,
      relationshipsByEntity,
      simulationMetadata
    );

    if (selectedType === 'relationship') {
      return expandTemplate(templates.defaults.relationship, context);
    }
    if (selectedType === 'era_narrative') {
      return expandTemplate(templates.defaults.eraNarrative, context);
    }

    const taskType = selectedType === 'description' ? 'description' : 'image';
    const effectiveTemplate = getEffectiveTemplate(templates, selectedEntity?.kind || selectedKind || 'npc', taskType);

    if (taskType === 'description') {
      return buildDescriptionPrompt(effectiveTemplate, context);
    } else {
      return buildImagePrompt(effectiveTemplate, context);
    }
  }, [
    templates,
    selectedType,
    selectedKind,
    selectedEntity,
    worldContext,
    prominentByCulture,
    entityById,
    relationshipsByEntity,
    simulationMetadata,
  ]);

  // Handle template changes
  const handleSectionChange = useCallback(
    (sectionKey, value) => {
      if (!onTemplatesChange) return;

      const newTemplates = { ...templates };
      const taskType = selectedType === 'description' ? 'description' : 'image';

      if (selectedType === 'relationship') {
        newTemplates.defaults = { ...newTemplates.defaults, relationship: value };
      } else if (selectedType === 'era_narrative') {
        newTemplates.defaults = { ...newTemplates.defaults, eraNarrative: value };
      } else if (selectedKind === null) {
        // Editing default
        newTemplates.defaults = {
          ...newTemplates.defaults,
          [taskType]: {
            ...newTemplates.defaults[taskType],
            [sectionKey]: value,
          },
        };
      } else {
        // Editing kind override
        newTemplates.byKind = {
          ...newTemplates.byKind,
          [selectedKind]: {
            ...newTemplates.byKind[selectedKind],
            [taskType]: {
              ...newTemplates.byKind[selectedKind]?.[taskType],
              [sectionKey]: value,
            },
          },
        };
      }

      onTemplatesChange(newTemplates);
    },
    [templates, selectedType, selectedKind, onTemplatesChange]
  );

  // Handle full template change (advanced mode)
  const handleFullTemplateChange = useCallback(
    (value) => {
      handleSectionChange('fullTemplate', value);
    },
    [handleSectionChange]
  );

  // Clear kind override
  const handleClearKindOverride = useCallback(() => {
    if (!onTemplatesChange || selectedKind === null) return;

    const taskType = selectedType === 'description' ? 'description' : 'image';
    const newTemplates = { ...templates };
    if (newTemplates.byKind[selectedKind]) {
      const { [taskType]: _, ...rest } = newTemplates.byKind[selectedKind];
      if (Object.keys(rest).length === 0) {
        const { [selectedKind]: __, ...restKinds } = newTemplates.byKind;
        newTemplates.byKind = restKinds;
      } else {
        newTemplates.byKind = {
          ...newTemplates.byKind,
          [selectedKind]: rest,
        };
      }
    }
    onTemplatesChange(newTemplates);
  }, [templates, selectedType, selectedKind, onTemplatesChange]);

  // Create kind override from default
  const handleCreateKindOverride = useCallback(() => {
    if (!onTemplatesChange || selectedKind === null) return;

    const taskType = selectedType === 'description' ? 'description' : 'image';
    const newTemplates = { ...templates };
    newTemplates.byKind = {
      ...newTemplates.byKind,
      [selectedKind]: {
        ...newTemplates.byKind[selectedKind],
        [taskType]: { ...templates.defaults[taskType] },
      },
    };
    onTemplatesChange(newTemplates);
  }, [templates, selectedType, selectedKind, onTemplatesChange]);

  const sections = selectedType === 'description' ? DESCRIPTION_SECTIONS : IMAGE_SECTIONS;
  const showKindSelector = selectedType === 'description' || selectedType === 'image';
  const showAdvancedToggle = selectedType === 'description' || selectedType === 'image';

  return (
    <div className="illuminator-template-editor">
      {/* Task Type Tabs */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Prompt Templates</h2>
          <span className="illuminator-card-subtitle">
            Customize prompts for each enrichment type
          </span>
        </div>

        <div className="illuminator-prompt-tabs">
          {TASK_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => {
                setSelectedType(type.id);
                setAdvancedMode(false);
              }}
              className={`illuminator-prompt-tab ${selectedType === type.id ? 'active' : ''}`}
            >
              <span>{type.icon}</span>
              <span>{type.label}</span>
            </button>
          ))}
        </div>

        {/* Kind Selector (for description/image) */}
        {showKindSelector && entityKinds.length > 0 && (
          <div className="illuminator-template-kind-section">
            <div className="illuminator-template-kind-header">
              <label className="illuminator-label">Entity Kind</label>
              <span className="illuminator-template-section-hint">
                Customize prompts per entity kind
              </span>
            </div>
            <KindSelector
              kinds={entityKinds}
              selectedKind={selectedKind}
              onSelectKind={setSelectedKind}
            />
            {selectedKind !== null && (
              <div className="illuminator-template-kind-actions">
                {hasKindOverride ? (
                  <>
                    <span className="illuminator-template-kind-badge">Custom</span>
                    <button
                      className="illuminator-button-link"
                      onClick={handleClearKindOverride}
                    >
                      Reset to default
                    </button>
                  </>
                ) : (
                  <>
                    <span className="illuminator-template-kind-badge default">Using default</span>
                    <button
                      className="illuminator-button-link"
                      onClick={handleCreateKindOverride}
                    >
                      Customize for {selectedKind}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mode Toggle */}
        {showAdvancedToggle && (
          <div className="illuminator-template-mode-toggle">
            <button
              onClick={() => setAdvancedMode(false)}
              className={`illuminator-mode-button ${!advancedMode ? 'active' : ''}`}
            >
              Structured
            </button>
            <button
              onClick={() => setAdvancedMode(true)}
              className={`illuminator-mode-button ${advancedMode ? 'active' : ''}`}
            >
              Advanced
            </button>
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">
            {selectedKind === null ? 'Default Template' : `${selectedKind} Template`}
          </h2>
          {currentTemplate.fullTemplate && (
            <span className="illuminator-template-full-badge">Using full template</span>
          )}
        </div>

        {(selectedType === 'relationship' || selectedType === 'era_narrative') ? (
          // Relationship and Era Narrative are single templates
          <div className="illuminator-template-section">
            <textarea
              className="illuminator-template-textarea illuminator-template-textarea-large"
              value={currentTemplate}
              onChange={(e) => handleSectionChange(selectedType === 'relationship' ? 'relationship' : 'eraNarrative', e.target.value)}
              rows={12}
            />
            <div className="illuminator-template-variables">
              <span className="illuminator-label">Available variables:</span>
              <code>{'{{entity.entity.name}}'}</code>
              <code>{'{{entity.entity.kind}}'}</code>
              <code>{'{{entity.entity.subtype}}'}</code>
              <code>{'{{entity.entity.prominence}}'}</code>
              <code>{'{{entity.entityAge}}'}</code>
              <code>{'{{entity.relationships}}'}</code>
              <code>{'{{entity.culturalPeers}}'}</code>
              <code>{'{{world.name}}'}</code>
              <code>{'{{world.tone}}'}</code>
            </div>
          </div>
        ) : advancedMode ? (
          // Advanced mode - full template editing
          <div className="illuminator-template-section">
            <div className="illuminator-template-section-header">
              <label className="illuminator-label">Full Template</label>
              <span className="illuminator-template-section-hint">
                Override all sections with a complete custom template
              </span>
            </div>
            <textarea
              className="illuminator-template-textarea illuminator-template-textarea-large"
              value={currentTemplate.fullTemplate || ''}
              onChange={(e) => handleFullTemplateChange(e.target.value)}
              placeholder="Enter a complete prompt template. Leave empty to use structured sections."
              rows={15}
            />
            {currentTemplate.fullTemplate && (
              <button
                className="illuminator-button-link"
                onClick={() => handleFullTemplateChange('')}
                style={{ marginTop: '8px' }}
              >
                Clear and use structured sections
              </button>
            )}
            <div className="illuminator-template-variables">
              <span className="illuminator-label">Available variables:</span>
              <code>{'{{entity.entity.name}}'}</code>
              <code>{'{{entity.entity.kind}}'}</code>
              <code>{'{{entity.entity.subtype}}'}</code>
              <code>{'{{entity.entity.prominence}}'}</code>
              <code>{'{{entity.entity.culture}}'}</code>
              <code>{'{{entity.entityAge}}'}</code>
              <code>{'{{entity.relationships}}'}</code>
              <code>{'{{entity.culturalPeers}}'}</code>
              <code>{'{{entity.factionMembers}}'}</code>
              <code>{'{{world.name}}'}</code>
              <code>{'{{world.description}}'}</code>
              <code>{'{{world.canonFacts}}'}</code>
              <code>{'{{world.tone}}'}</code>
            </div>
          </div>
        ) : (
          // Structured mode - section-by-section editing
          <div className="illuminator-template-sections">
            {sections.map((section) => (
              <TemplateSection
                key={section.key}
                section={section}
                value={currentTemplate[section.key]}
                onChange={handleSectionChange}
                disabled={!!currentTemplate.fullTemplate}
              />
            ))}
            {currentTemplate.fullTemplate && (
              <div className="illuminator-template-override-notice">
                These sections are overridden by a full template.
                Switch to Advanced mode to edit.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live Preview */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Live Preview</h2>
          {exampleEntities.length > 0 && (
            <select
              value={selectedEntityId}
              onChange={(e) => setSelectedEntityId(e.target.value)}
              className="illuminator-select"
              style={{ width: 'auto', minWidth: '200px' }}
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
          )}
        </div>

        <pre className="illuminator-prompt-preview illuminator-prompt-preview-large">
          {preview}
        </pre>

        {selectedEntity && (
          <>
            <div className="illuminator-preview-entity-info">
              <span className="illuminator-preview-entity-badge">{selectedEntity.kind}/{selectedEntity.subtype}</span>
              <span className="illuminator-preview-entity-badge">{selectedEntity.prominence}</span>
              <span className="illuminator-preview-entity-badge">{selectedEntity.culture || 'no culture'}</span>
              <span className="illuminator-preview-entity-badge">{calculateEntityAge(selectedEntity, simulationMetadata)}</span>
            </div>

            {/* Show auto-built context */}
            {selectedRelationships.length > 0 && (
              <div style={{
                marginTop: '12px',
                padding: '10px',
                background: 'var(--bg-tertiary)',
                borderRadius: '4px',
                fontSize: '11px',
              }}>
                <div style={{ fontWeight: 500, marginBottom: '6px', color: 'var(--text-muted)' }}>
                  Auto-detected relationships ({selectedRelationships.length}):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {selectedRelationships.slice(0, 6).map((rel, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '2px 6px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '3px',
                      }}
                    >
                      {rel.kind}: {rel.targetName}
                    </span>
                  ))}
                  {selectedRelationships.length > 6 && (
                    <span style={{ opacity: 0.6 }}>+{selectedRelationships.length - 6} more</span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
