import { useState, useRef, useEffect } from 'react';
import './HeaderMenu.css';

export type EdgeMetric = 'strength' | 'distance' | 'none';

interface HeaderMenuProps {
  is3DView: boolean;
  edgeMetric: EdgeMetric;
  onToggle3D: () => void;
  onEdgeMetricChange: (metric: EdgeMetric) => void;
  onRecalculateLayout: () => void;
  onToggleStats: () => void;
}

export default function HeaderMenu({ is3DView, edgeMetric, onToggle3D, onEdgeMetricChange, onRecalculateLayout, onToggleStats }: HeaderMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleMenuItemClick = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="header-menu" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="header-menu-button"
        title="Menu"
      >
        <span className="header-menu-icon">☰</span>
      </button>

      {isOpen && (
        <div className="header-menu-dropdown">
          <button
            onClick={() => handleMenuItemClick(onToggle3D)}
            className="header-menu-item"
          >
            <span className="header-menu-item-icon">{is3DView ? '📊' : '🌐'}</span>
            <span>{is3DView ? '2D View' : '3D View'}</span>
          </button>

          <div className="header-menu-section">
            <div className="header-menu-section-title">Edge Spring Metric</div>
            <button
              onClick={() => handleMenuItemClick(() => onEdgeMetricChange('strength'))}
              className={`header-menu-item ${edgeMetric === 'strength' ? 'active' : ''}`}
            >
              <span className="header-menu-item-icon">{edgeMetric === 'strength' ? '✓' : '○'}</span>
              <span>Strength</span>
            </button>
            <button
              onClick={() => handleMenuItemClick(() => onEdgeMetricChange('distance'))}
              className={`header-menu-item ${edgeMetric === 'distance' ? 'active' : ''}`}
            >
              <span className="header-menu-item-icon">{edgeMetric === 'distance' ? '✓' : '○'}</span>
              <span>Distance</span>
            </button>
            <button
              onClick={() => handleMenuItemClick(() => onEdgeMetricChange('none'))}
              className={`header-menu-item ${edgeMetric === 'none' ? 'active' : ''}`}
            >
              <span className="header-menu-item-icon">{edgeMetric === 'none' ? '✓' : '○'}</span>
              <span>None (Equal)</span>
            </button>
          </div>

          <button
            onClick={() => handleMenuItemClick(onRecalculateLayout)}
            className="header-menu-item"
          >
            <span className="header-menu-item-icon">♻️</span>
            <span>Recalculate Layout</span>
          </button>

          <button
            onClick={() => handleMenuItemClick(onToggleStats)}
            className="header-menu-item"
          >
            <span className="header-menu-item-icon">📊</span>
            <span>Toggle Stats</span>
          </button>
        </div>
      )}
    </div>
  );
}
