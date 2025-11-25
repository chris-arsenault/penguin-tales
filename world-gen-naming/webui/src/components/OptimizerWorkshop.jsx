import { useState, useEffect, useMemo } from 'react';

const API_URL = 'http://localhost:3001';

/**
 * Algorithm configurations with their specific parameters
 */
const ALGORITHMS = {
  hillclimb: {
    name: 'Hill Climbing',
    description: 'Simple local search that iteratively improves by small steps. Fast but may get stuck in local optima.',
    params: {
      iterations: { type: 'number', label: 'Iterations', default: 50, min: 10, max: 500 },
    }
  },
  sim_anneal: {
    name: 'Simulated Annealing',
    description: 'Probabilistic search that can escape local optima by occasionally accepting worse solutions.',
    params: {
      iterations: { type: 'number', label: 'Iterations', default: 100, min: 10, max: 500 },
      initialTemperature: { type: 'number', label: 'Initial Temperature', default: 1.0, min: 0.1, max: 10, step: 0.1 },
      coolingRate: { type: 'number', label: 'Cooling Rate', default: 0.95, min: 0.5, max: 0.99, step: 0.01 },
    }
  },
  ga: {
    name: 'Genetic Algorithm',
    description: 'Population-based evolution with crossover and mutation. Great for exploring discrete phoneme combinations.',
    params: {
      iterations: { type: 'number', label: 'Generations', default: 50, min: 5, max: 200 },
      populationSize: { type: 'number', label: 'Population Size', default: 16, min: 4, max: 64 },
    }
  },
  bayes: {
    name: 'Bayesian Optimization (TPE)',
    description: 'Efficient search using Tree-structured Parzen Estimators. Models probability of good configurations.',
    params: {
      iterations: { type: 'number', label: 'Iterations', default: 50, min: 10, max: 200 },
    }
  },
  cluster: {
    name: 'Cluster Discovery',
    description: 'Analyzes generated names to discover effective consonant clusters and borrows from sibling domains.',
    params: {}
  }
};

/**
 * Optimizer Workshop - Dedicated UI for domain optimization
 */
export default function OptimizerWorkshop({ metaDomain, cultures }) {
  // Domain selection state
  const [selectedDomains, setSelectedDomains] = useState(new Set());
  const [expandedCultures, setExpandedCultures] = useState(new Set());

  // Algorithm and settings state
  const [algorithm, setAlgorithm] = useState('hillclimb');
  const [algorithmParams, setAlgorithmParams] = useState({});
  const [validationSettings, setValidationSettings] = useState({
    requiredNames: 500,
    sampleFactor: 10,
  });
  const [fitnessWeights, setFitnessWeights] = useState({
    capacity: 0.2,
    diffuseness: 0.2,
    separation: 0.2,
    pronounceability: 0.3,
    length: 0.1,
    style: 0.0,
  });

  // Optimization state
  const [optimizing, setOptimizing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentDomain: '' });
  const [results, setResults] = useState([]);
  const [logs, setLogs] = useState([]);
  const [showModal, setShowModal] = useState(false);

  // Collect all domains from all cultures
  const allDomains = useMemo(() => {
    const domains = [];
    Object.entries(cultures || {}).forEach(([cultureId, culture]) => {
      (culture.domains || []).forEach(domain => {
        domains.push({
          ...domain,
          cultureId,
          cultureName: culture.name || cultureId,
        });
      });
    });
    return domains;
  }, [cultures]);

  // Initialize algorithm params when algorithm changes
  useEffect(() => {
    const config = ALGORITHMS[algorithm];
    if (config?.params) {
      const defaults = {};
      Object.entries(config.params).forEach(([key, param]) => {
        defaults[key] = param.default;
      });
      setAlgorithmParams(defaults);
    }
  }, [algorithm]);

  // Toggle culture expansion
  const toggleCulture = (cultureId) => {
    setExpandedCultures(prev => {
      const next = new Set(prev);
      if (next.has(cultureId)) {
        next.delete(cultureId);
      } else {
        next.add(cultureId);
      }
      return next;
    });
  };

  // Toggle domain selection
  const toggleDomain = (domainId) => {
    setSelectedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domainId)) {
        next.delete(domainId);
      } else {
        next.add(domainId);
      }
      return next;
    });
  };

  // Select/deselect all domains in a culture
  const toggleAllInCulture = (cultureId) => {
    const cultureDomains = allDomains.filter(d => d.cultureId === cultureId);
    const allSelected = cultureDomains.every(d => selectedDomains.has(d.id));

    setSelectedDomains(prev => {
      const next = new Set(prev);
      cultureDomains.forEach(d => {
        if (allSelected) {
          next.delete(d.id);
        } else {
          next.add(d.id);
        }
      });
      return next;
    });
  };

  // Select all domains
  const selectAll = () => {
    setSelectedDomains(new Set(allDomains.map(d => d.id)));
  };

  // Deselect all domains
  const deselectAll = () => {
    setSelectedDomains(new Set());
  };

  // Add log entry
  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, timestamp: new Date().toISOString() }]);
  };

  // Run optimization
  const handleOptimize = async () => {
    const domainsToOptimize = allDomains.filter(d => selectedDomains.has(d.id));

    if (domainsToOptimize.length === 0) {
      addLog('No domains selected', 'error');
      return;
    }

    setOptimizing(true);
    setResults([]);
    setLogs([]);
    setProgress({ current: 0, total: domainsToOptimize.length, currentDomain: '' });
    setShowModal(true);

    addLog(`Starting optimization of ${domainsToOptimize.length} domain(s) using ${ALGORITHMS[algorithm].name}`, 'info');

    const newResults = [];

    for (let i = 0; i < domainsToOptimize.length; i++) {
      const domain = domainsToOptimize[i];
      setProgress({ current: i + 1, total: domainsToOptimize.length, currentDomain: domain.id });
      addLog(`[${i + 1}/${domainsToOptimize.length}] Optimizing ${domain.id}...`, 'info');

      try {
        // Get all sibling domains for separation metric
        const siblingDomains = allDomains.filter(d => d.id !== domain.id);

        const response = await fetch(`${API_URL}/api/optimize/domain`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domain,
            validationSettings,
            fitnessWeights,
            optimizationSettings: {
              algorithm,
              ...algorithmParams,
            },
            siblingDomains,
          }),
        });

        const data = await response.json();

        if (response.ok && data.result?.optimizedConfig) {
          const result = {
            domainId: domain.id,
            cultureId: domain.cultureId,
            initialFitness: data.result.initialFitness,
            finalFitness: data.result.finalFitness,
            improvement: data.result.improvement,
            optimizedConfig: data.result.optimizedConfig,
            success: true,
          };
          newResults.push(result);
          addLog(`  ${domain.id}: ${(result.initialFitness || 0).toFixed(3)} -> ${(result.finalFitness || 0).toFixed(3)} (+${((result.improvement || 0) * 100).toFixed(1)}%)`, 'success');
        } else {
          newResults.push({
            domainId: domain.id,
            cultureId: domain.cultureId,
            error: data.error || 'Unknown error',
            success: false,
          });
          addLog(`  ${domain.id}: Error - ${data.error || 'Unknown error'}`, 'error');
        }
      } catch (error) {
        newResults.push({
          domainId: domain.id,
          cultureId: domain.cultureId,
          error: error.message,
          success: false,
        });
        addLog(`  ${domain.id}: Error - ${error.message}`, 'error');
      }
    }

    setResults(newResults);
    setOptimizing(false);
    setProgress({ current: 0, total: 0, currentDomain: '' });

    const successCount = newResults.filter(r => r.success).length;
    addLog(`Optimization complete: ${successCount}/${domainsToOptimize.length} succeeded`, successCount === domainsToOptimize.length ? 'success' : 'warning');
  };

  // Save results to disk
  const handleSaveResults = async () => {
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length === 0) {
      addLog('No successful results to save', 'error');
      return;
    }

    addLog(`Saving ${successfulResults.length} optimized domain(s)...`, 'info');

    // Group by culture
    const byCulture = {};
    successfulResults.forEach(r => {
      if (!byCulture[r.cultureId]) {
        byCulture[r.cultureId] = [];
      }
      byCulture[r.cultureId].push(r);
    });

    // Save each culture's domains
    for (const [cultureId, cultureResults] of Object.entries(byCulture)) {
      const culture = cultures[cultureId];
      if (!culture?.domains) continue;

      // Replace optimized domains
      const updatedDomains = culture.domains.map(domain => {
        const optimized = cultureResults.find(r => r.domainId === domain.id);
        return optimized ? optimized.optimizedConfig : domain;
      });

      try {
        const response = await fetch(`${API_URL}/api/v2/cultures/${metaDomain}/${cultureId}/domains`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domains: updatedDomains }),
        });

        if (response.ok) {
          addLog(`  Saved ${cultureResults.length} domain(s) to ${cultureId}`, 'success');
        } else {
          addLog(`  Failed to save ${cultureId}: ${response.statusText}`, 'error');
        }
      } catch (error) {
        addLog(`  Failed to save ${cultureId}: ${error.message}`, 'error');
      }
    }

    addLog('Save complete', 'success');
  };

  // Render algorithm parameter inputs
  const renderAlgorithmParams = () => {
    const config = ALGORITHMS[algorithm];
    if (!config?.params || Object.keys(config.params).length === 0) {
      return <p style={{ color: 'var(--arctic-frost)', fontSize: '0.85rem', fontStyle: 'italic' }}>No additional parameters for this algorithm.</p>;
    }

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
        {Object.entries(config.params).map(([key, param]) => (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--arctic-light)' }}>{param.label}</label>
            <input
              type="number"
              value={algorithmParams[key] ?? param.default}
              onChange={(e) => setAlgorithmParams(prev => ({ ...prev, [key]: parseFloat(e.target.value) || param.default }))}
              min={param.min}
              max={param.max}
              step={param.step || 1}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.3)', background: 'rgba(30, 58, 95, 0.5)', color: '#ffffff' }}
            />
          </div>
        ))}
      </div>
    );
  };

  // Group domains by culture
  const domainsByCulture = useMemo(() => {
    const grouped = {};
    allDomains.forEach(domain => {
      if (!grouped[domain.cultureId]) {
        grouped[domain.cultureId] = {
          name: domain.cultureName,
          domains: []
        };
      }
      grouped[domain.cultureId].domains.push(domain);
    });
    return grouped;
  }, [allDomains]);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left Panel - Domain Selection */}
      <div style={{
        width: '300px',
        borderRight: '1px solid rgba(59, 130, 246, 0.2)',
        background: 'rgba(30, 58, 95, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid rgba(59, 130, 246, 0.2)', background: 'rgba(30, 58, 95, 0.3)' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: 'var(--arctic-light)' }}>Select Domains</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={selectAll} className="secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
              Select All
            </button>
            <button onClick={deselectAll} className="secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
              Clear
            </button>
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--arctic-frost)' }}>
            {selectedDomains.size} of {allDomains.length} selected
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {Object.entries(domainsByCulture).map(([cultureId, { name, domains }]) => {
            const isExpanded = expandedCultures.has(cultureId);
            const allSelected = domains.every(d => selectedDomains.has(d.id));
            const someSelected = domains.some(d => selectedDomains.has(d.id));

            return (
              <div key={cultureId} style={{ marginBottom: '0.5rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem',
                    background: 'rgba(45, 74, 111, 0.5)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    border: '1px solid rgba(59, 130, 246, 0.15)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={() => toggleAllInCulture(cultureId)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ accentColor: 'var(--arctic-ice)' }}
                  />
                  <span
                    onClick={() => toggleCulture(cultureId)}
                    style={{ flex: 1, fontWeight: 500, fontSize: '0.9rem', color: '#ffffff' }}
                  >
                    {isExpanded ? '▼' : '▶'} {name || cultureId}
                    <span style={{ color: 'var(--arctic-frost)', fontWeight: 400, marginLeft: '0.5rem' }}>
                      ({domains.length})
                    </span>
                  </span>
                </div>

                {isExpanded && (
                  <div style={{ paddingLeft: '1.5rem', marginTop: '0.25rem' }}>
                    {domains.map(domain => (
                      <div
                        key={domain.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.35rem 0.5rem',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          background: selectedDomains.has(domain.id) ? 'rgba(251, 191, 36, 0.15)' : 'transparent',
                          color: selectedDomains.has(domain.id) ? 'var(--gold-accent)' : 'var(--arctic-light)',
                        }}
                        onClick={() => toggleDomain(domain.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedDomains.has(domain.id)}
                          onChange={() => toggleDomain(domain.id)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ accentColor: 'var(--gold-accent)' }}
                        />
                        <span>{domain.id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {allDomains.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--arctic-frost)' }}>
              No domains found. Create domains in the Workshop tab first.
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Settings & Results */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(10, 25, 41, 0.3)' }}>
        {/* Settings */}
        <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(59, 130, 246, 0.2)', overflowY: 'auto' }}>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--arctic-light)' }}>Optimizer Settings</h2>

          {/* Algorithm Selection */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--arctic-frost)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Algorithm</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
              {Object.entries(ALGORITHMS).map(([key, config]) => (
                <div
                  key={key}
                  onClick={() => setAlgorithm(key)}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '6px',
                    border: `2px solid ${algorithm === key ? 'var(--gold-accent)' : 'rgba(59, 130, 246, 0.3)'}`,
                    background: algorithm === key ? 'rgba(251, 191, 36, 0.12)' : 'rgba(30, 58, 95, 0.4)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: algorithm === key ? 'var(--gold-accent)' : '#ffffff' }}>{config.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--arctic-frost)', lineHeight: 1.4 }}>
                    {config.description}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Algorithm-Specific Parameters */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--arctic-frost)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Algorithm Parameters</h3>
            {renderAlgorithmParams()}
          </div>

          {/* Validation Settings */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--arctic-frost)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Validation Settings</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--arctic-light)' }}>Sample Size</label>
                <input
                  type="number"
                  value={validationSettings.requiredNames}
                  onChange={(e) => setValidationSettings(prev => ({ ...prev, requiredNames: parseInt(e.target.value) || 500 }))}
                  min={100}
                  max={5000}
                  style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.3)', background: 'rgba(30, 58, 95, 0.5)', color: '#ffffff' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--arctic-light)' }}>Sample Factor</label>
                <input
                  type="number"
                  value={validationSettings.sampleFactor}
                  onChange={(e) => setValidationSettings(prev => ({ ...prev, sampleFactor: parseInt(e.target.value) || 10 }))}
                  min={1}
                  max={50}
                  style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.3)', background: 'rgba(30, 58, 95, 0.5)', color: '#ffffff' }}
                />
              </div>
            </div>
          </div>

          {/* Fitness Weights */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--arctic-frost)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fitness Weights</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
              {[
                { key: 'capacity', label: 'Capacity', title: 'Entropy / collision rate' },
                { key: 'diffuseness', label: 'Diffuseness', title: 'Intra-domain variation' },
                { key: 'separation', label: 'Separation', title: 'Inter-domain distinctiveness' },
                { key: 'pronounceability', label: 'Pronounce', title: 'Phonetic naturalness' },
                { key: 'length', label: 'Length', title: 'Target length adherence' },
                { key: 'style', label: 'Style', title: 'LLM style judge (optional)' },
              ].map(({ key, label, title }) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--arctic-light)' }} title={title}>{label}</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={fitnessWeights[key]}
                    onChange={(e) => setFitnessWeights(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                    title={title}
                    disabled={key === 'separation' && allDomains.length <= 1}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '4px',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      background: 'rgba(30, 58, 95, 0.5)',
                      color: '#ffffff',
                      opacity: key === 'separation' && allDomains.length <= 1 ? 0.5 : 1,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Run Button */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleOptimize}
              disabled={optimizing || selectedDomains.size === 0}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                fontWeight: 600,
                background: 'var(--gold-accent)',
                color: 'var(--arctic-deep)',
                border: 'none',
                borderRadius: '6px',
                cursor: optimizing || selectedDomains.size === 0 ? 'not-allowed' : 'pointer',
                opacity: optimizing || selectedDomains.size === 0 ? 0.6 : 1,
              }}
            >
              {optimizing ? 'Optimizing...' : `Optimize ${selectedDomains.size} Domain(s)`}
            </button>

            {results.length > 0 && results.some(r => r.success) && (
              <button
                onClick={handleSaveResults}
                className="secondary"
                style={{ padding: '0.75rem 1.5rem' }}
              >
                Save Results
              </button>
            )}

            {optimizing && (
              <span style={{ fontSize: '0.85rem', color: 'var(--arctic-frost)' }}>
                {progress.current}/{progress.total}: {progress.currentDomain}
              </span>
            )}
          </div>
        </div>

        {/* Status Bar - Shows when there are results */}
        {results.length > 0 && !optimizing && (
          <div style={{
            padding: '1rem 1.25rem',
            background: 'rgba(30, 58, 95, 0.5)',
            borderTop: '1px solid rgba(59, 130, 246, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ color: 'var(--arctic-light)', fontSize: '0.9rem' }}>
                Last run: <strong style={{ color: '#86efac' }}>{results.filter(r => r.success).length}</strong> succeeded,{' '}
                <strong style={{ color: results.some(r => !r.success) ? '#f87171' : 'var(--arctic-light)' }}>{results.filter(r => !r.success).length}</strong> failed
              </span>
              {results.filter(r => r.success).length > 0 && (
                <span style={{ color: 'var(--gold-accent)', fontSize: '0.9rem', fontWeight: 600 }}>
                  Avg improvement: +{(results.filter(r => r.success).reduce((sum, r) => sum + (r.improvement || 0), 0) / results.filter(r => r.success).length * 100).toFixed(1)}%
                </span>
              )}
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="secondary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              View Details
            </button>
          </div>
        )}
      </div>

      {/* Optimization Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 25, 41, 0.9)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !optimizing) setShowModal(false); }}
        >
          <div style={{
            background: 'linear-gradient(135deg, var(--arctic-dark) 0%, var(--arctic-mid) 100%)',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '900px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--arctic-light)' }}>
                {optimizing ? 'Optimization in Progress...' : 'Optimization Results'}
              </h2>
              {!optimizing && (
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--arctic-frost)',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    padding: '0.25rem 0.5rem',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </div>

            {/* Progress Bar (during optimization) */}
            {optimizing && (
              <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--arctic-light)', fontSize: '0.9rem' }}>
                    Processing: <strong>{progress.currentDomain}</strong>
                  </span>
                  <span style={{ color: 'var(--arctic-frost)', fontSize: '0.9rem' }}>
                    {progress.current} / {progress.total}
                  </span>
                </div>
                <div style={{
                  height: '8px',
                  background: 'rgba(10, 25, 41, 0.5)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${progress.total > 0 ? (progress.current / progress.total * 100) : 0}%`,
                    background: 'linear-gradient(90deg, var(--arctic-ice), var(--gold-accent))',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
            )}

            {/* Modal Body - Log and Results */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Log Section */}
              <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', minHeight: 0 }}>
                <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--arctic-frost)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Optimization Log
                </h3>
                <div style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '0.875rem',
                  lineHeight: 1.7,
                  background: 'rgba(10, 25, 41, 0.6)',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  maxHeight: '250px',
                  overflowY: 'auto',
                }}>
                  {logs.map((log, i) => (
                    <div
                      key={i}
                      style={{
                        color: log.type === 'error' ? '#f87171' : log.type === 'success' ? '#86efac' : log.type === 'warning' ? '#fde047' : 'var(--arctic-light)',
                        padding: '0.25rem 0',
                      }}
                    >
                      {log.message}
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <div style={{ color: 'var(--arctic-frost)', fontStyle: 'italic' }}>Waiting for optimization to start...</div>
                  )}
                </div>

                {/* Results Table */}
                {results.length > 0 && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--arctic-frost)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Results Summary
                    </h3>
                    <div style={{
                      background: 'rgba(10, 25, 41, 0.6)',
                      borderRadius: '8px',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      overflow: 'hidden',
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ background: 'rgba(30, 58, 95, 0.5)' }}>
                            <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: 'var(--arctic-frost)', fontWeight: 600 }}>Domain</th>
                            <th style={{ textAlign: 'right', padding: '0.75rem 1rem', color: 'var(--arctic-frost)', fontWeight: 600 }}>Initial</th>
                            <th style={{ textAlign: 'right', padding: '0.75rem 1rem', color: 'var(--arctic-frost)', fontWeight: 600 }}>Final</th>
                            <th style={{ textAlign: 'right', padding: '0.75rem 1rem', color: 'var(--arctic-frost)', fontWeight: 600 }}>Improvement</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((result, i) => (
                            <tr key={i} style={{ borderTop: '1px solid rgba(59, 130, 246, 0.15)' }}>
                              <td style={{ padding: '0.75rem 1rem', color: '#ffffff' }}>
                                {result.success ? (
                                  <span style={{ color: '#86efac', marginRight: '0.5rem' }}>✓</span>
                                ) : (
                                  <span style={{ color: '#f87171', marginRight: '0.5rem' }}>✗</span>
                                )}
                                {result.domainId}
                              </td>
                              <td style={{ textAlign: 'right', padding: '0.75rem 1rem', color: 'var(--arctic-light)' }}>
                                {result.success ? result.initialFitness?.toFixed(3) : '-'}
                              </td>
                              <td style={{ textAlign: 'right', padding: '0.75rem 1rem', color: 'var(--arctic-light)' }}>
                                {result.success ? result.finalFitness?.toFixed(3) : '-'}
                              </td>
                              <td style={{
                                textAlign: 'right',
                                padding: '0.75rem 1rem',
                                color: result.success ? 'var(--gold-accent)' : '#f87171',
                                fontWeight: result.success ? 600 : 400
                              }}>
                                {result.success ? `+${((result.improvement || 0) * 100).toFixed(1)}%` : result.error}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid rgba(59, 130, 246, 0.2)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              background: 'rgba(10, 25, 41, 0.3)',
            }}>
              {results.length > 0 && results.some(r => r.success) && !optimizing && (
                <button
                  onClick={handleSaveResults}
                  style={{
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    background: 'var(--gold-accent)',
                    color: 'var(--arctic-deep)',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Save Results
                </button>
              )}
              <button
                onClick={() => setShowModal(false)}
                disabled={optimizing}
                className="secondary"
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.95rem',
                  opacity: optimizing ? 0.5 : 1,
                  cursor: optimizing ? 'not-allowed' : 'pointer',
                }}
              >
                {optimizing ? 'Running...' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
