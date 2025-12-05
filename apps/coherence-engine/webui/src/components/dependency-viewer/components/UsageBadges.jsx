/**
 * UsageBadges - Display usage badges for an item
 */

import React from 'react';
import '../dependency-viewer.css';

export function UsageBadges({ usage }) {
  const badges = [];

  if (usage.generators?.length > 0) {
    badges.push(
      <span key="gen" className="dependency-badge dependency-badge-generator">
        {usage.generators.length} gen
      </span>
    );
  }
  if (usage.systems?.length > 0) {
    badges.push(
      <span key="sys" className="dependency-badge dependency-badge-system">
        {usage.systems.length} sys
      </span>
    );
  }
  if (usage.actions?.length > 0) {
    badges.push(
      <span key="act" className="dependency-badge dependency-badge-action">
        {usage.actions.length} act
      </span>
    );
  }
  if (usage.pressures?.length > 0) {
    badges.push(
      <span key="pres" className="dependency-badge dependency-badge-pressure">
        {usage.pressures.length} pres
      </span>
    );
  }
  if (usage.eras?.length > 0) {
    badges.push(
      <span key="era" className="dependency-badge dependency-badge-era">
        {usage.eras.length} era{usage.eras.length !== 1 ? 's' : ''}
      </span>
    );
  }

  if (badges.length === 0) {
    return <span className="dependency-orphan-badge">Not used</span>;
  }

  return <div className="dependency-used-by-list">{badges}</div>;
}
