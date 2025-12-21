/**
 * GeneratorModal - Modal for editing a generator
 */

import React, { useState, useMemo, useCallback } from 'react';
import { getElementValidation } from '@penguin-tales/shared-components';
import { TABS } from './constants';
import { ModalShell, TabValidationBadge, OrphanBadge } from '../shared';
import {
  OverviewTab,
  TargetTab,
  VariablesTab,
  CreationTab,
  RelationshipsTab,
  EffectsTab,
  ApplicabilityTab,
  UnmappedTab,
} from './tabs';

// Known top-level properties for a DeclarativeTemplate
const KNOWN_PROPERTIES = new Set([
  'id',
  'name',
  'enabled',
  'applicability',
  'selection',
  'creation',
  'relationships',
  'stateUpdates',
  'variables',
  'variants',
]);

// Known stateUpdate types
const KNOWN_STATE_UPDATE_TYPES = new Set([
  'modify_pressure',
  'archive_relationship',
  'change_status',
  'set_tag',
  'remove_tag',
  'update_rate_limit',
]);

function countUnmappedProperties(generator) {
  if (!generator) return 0;
  let count = 0;

  // Count unknown top-level properties
  Object.keys(generator).forEach(key => {
    if (!KNOWN_PROPERTIES.has(key)) count++;
  });

  // Count unknown stateUpdate types
  (generator.stateUpdates || []).forEach(update => {
    if (!KNOWN_STATE_UPDATE_TYPES.has(update.type)) count++;
  });

  return count;
}

// Helper to compute validation issues per generator tab
function computeTabValidation(generator, usageMap) {
  const validation = usageMap ? getElementValidation(usageMap, 'generator', generator.id) : { invalidRefs: [], isOrphan: false };

  const tabErrors = {
    overview: 0,
    applicability: 0,
    target: 0,
    variables: 0,
    creation: 0,
    relationships: 0,
    effects: 0,
  };

  validation.invalidRefs.forEach(ref => {
    if (ref.field.includes('applicability')) tabErrors.applicability++;
    else if (ref.field.includes('selection') || ref.field.includes('target')) tabErrors.target++;
    else if (ref.field.includes('creation')) tabErrors.creation++;
    else if (ref.field.includes('relationships')) tabErrors.relationships++;
    else if (ref.field.includes('stateUpdates') || ref.field.includes('pressure')) tabErrors.effects++;
  });

  return { tabErrors, isOrphan: validation.isOrphan, totalErrors: validation.invalidRefs.length };
}

export function GeneratorModal({ generator, onChange, onClose, onDelete, onDuplicate, schema, pressures, eras, usageMap, tagRegistry = [] }) {
  const [activeTab, setActiveTab] = useState('overview');

  const tabValidation = useMemo(() =>
    computeTabValidation(generator, usageMap),
    [generator, usageMap]
  );

  // Count unmapped properties to show tab conditionally
  const unmappedCount = useMemo(() => countUnmappedProperties(generator), [generator]);

  // Build tabs list - add Unmapped tab if there are unmapped properties
  const tabs = useMemo(() => {
    if (unmappedCount > 0) {
      return [...TABS, { id: 'unmapped', label: 'Unmapped', icon: '⚠️' }];
    }
    return TABS;
  }, [unmappedCount]);

  const renderTabBadge = useCallback((tabId) => {
    if (tabId === 'unmapped') {
      return <TabValidationBadge count={unmappedCount} />;
    }
    return <TabValidationBadge count={tabValidation.tabErrors[tabId]} />;
  }, [tabValidation.tabErrors, unmappedCount]);

  const sidebarFooter = tabValidation.isOrphan ? (
    <div className="orphan-badge-container">
      <OrphanBadge isOrphan={true} />
    </div>
  ) : null;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab generator={generator} onChange={onChange} onDelete={onDelete} onDuplicate={onDuplicate} />;
      case 'applicability':
        return <ApplicabilityTab generator={generator} onChange={onChange} schema={schema} pressures={pressures} eras={eras} />;
      case 'target':
        return <TargetTab generator={generator} onChange={onChange} schema={schema} />;
      case 'variables':
        return <VariablesTab generator={generator} onChange={onChange} schema={schema} />;
      case 'creation':
        return <CreationTab generator={generator} onChange={onChange} schema={schema} tagRegistry={tagRegistry} pressures={pressures} />;
      case 'relationships':
        return <RelationshipsTab generator={generator} onChange={onChange} schema={schema} />;
      case 'effects':
        return <EffectsTab generator={generator} onChange={onChange} pressures={pressures} schema={schema} />;
      case 'unmapped':
        return <UnmappedTab generator={generator} onChange={onChange} />;
      default:
        return null;
    }
  };

  return (
    <ModalShell
      onClose={onClose}
      icon="⚙️"
      title={generator.name || generator.id}
      disabled={generator.enabled === false}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      renderTabBadge={renderTabBadge}
      sidebarFooter={sidebarFooter}
    >
      {renderTabContent()}
    </ModalShell>
  );
}

export default GeneratorModal;
