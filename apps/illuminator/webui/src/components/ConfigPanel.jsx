/**
 * ConfigPanel - Enrichment configuration settings
 *
 * Allows users to configure:
 * - Which enrichment types to run (descriptions, images, etc.)
 * - Prominence thresholds
 * - Model selection
 * - Batch settings
 */

const PROMINENCE_LEVELS = [
  { value: 'forgotten', label: 'Forgotten' },
  { value: 'marginal', label: 'Marginal' },
  { value: 'recognized', label: 'Recognized' },
  { value: 'renowned', label: 'Renowned' },
  { value: 'mythic', label: 'Mythic' },
];

const TEXT_MODELS = [
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (faster)' },
];

const IMAGE_MODELS = [
  { value: 'dall-e-3', label: 'DALL-E 3' },
  { value: 'dall-e-2', label: 'DALL-E 2 (cheaper)' },
];

const IMAGE_SIZES = [
  { value: '1024x1024', label: '1024x1024 (Square)' },
  { value: '1792x1024', label: '1792x1024 (Landscape)' },
  { value: '1024x1792', label: '1024x1792 (Portrait)' },
];

export default function ConfigPanel({ config, onConfigChange, worldSchema }) {
  return (
    <div>
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Enrichment Types</h2>
        </div>

        <div className="illuminator-checkbox-group">
          <input
            type="checkbox"
            id="enrichDescriptions"
            checked={config.enrichDescriptions}
            onChange={(e) => onConfigChange({ enrichDescriptions: e.target.checked })}
            className="illuminator-checkbox"
          />
          <label htmlFor="enrichDescriptions">Enrich entity descriptions</label>
        </div>

        <div className="illuminator-checkbox-group">
          <input
            type="checkbox"
            id="enrichRelationships"
            checked={config.enrichRelationships}
            onChange={(e) => onConfigChange({ enrichRelationships: e.target.checked })}
            className="illuminator-checkbox"
          />
          <label htmlFor="enrichRelationships">Enrich relationship stories</label>
        </div>

        <div className="illuminator-checkbox-group">
          <input
            type="checkbox"
            id="enrichEraNarratives"
            checked={config.enrichEraNarratives}
            onChange={(e) => onConfigChange({ enrichEraNarratives: e.target.checked })}
            className="illuminator-checkbox"
          />
          <label htmlFor="enrichEraNarratives">Generate era narratives</label>
        </div>

        <div className="illuminator-checkbox-group">
          <input
            type="checkbox"
            id="generateImages"
            checked={config.generateImages}
            onChange={(e) => onConfigChange({ generateImages: e.target.checked })}
            className="illuminator-checkbox"
          />
          <label htmlFor="generateImages">Generate entity images</label>
        </div>
      </div>

      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Prominence Thresholds</h2>
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">
            Minimum prominence for descriptions
          </label>
          <select
            value={config.minProminenceForDescription}
            onChange={(e) => onConfigChange({ minProminenceForDescription: e.target.value })}
            className="illuminator-select"
          >
            {PROMINENCE_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">
            Minimum prominence for images
          </label>
          <select
            value={config.minProminenceForImage}
            onChange={(e) => onConfigChange({ minProminenceForImage: e.target.value })}
            className="illuminator-select"
          >
            {PROMINENCE_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Images are expensive - consider limiting to Mythic entities
          </p>
        </div>
      </div>

      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Model Settings</h2>
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">Text model (Anthropic)</label>
          <select
            value={config.textModel}
            onChange={(e) => onConfigChange({ textModel: e.target.value })}
            className="illuminator-select"
          >
            {TEXT_MODELS.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">Image model (OpenAI)</label>
          <select
            value={config.imageModel}
            onChange={(e) => onConfigChange({ imageModel: e.target.value })}
            className="illuminator-select"
            disabled={!config.generateImages}
          >
            {IMAGE_MODELS.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">Image size</label>
          <select
            value={config.imageSize}
            onChange={(e) => onConfigChange({ imageSize: e.target.value })}
            className="illuminator-select"
            disabled={!config.generateImages}
          >
            {IMAGE_SIZES.map((size) => (
              <option key={size.value} value={size.value}>
                {size.label}
              </option>
            ))}
          </select>
        </div>

        <div className="illuminator-checkbox-group">
          <input
            type="checkbox"
            id="imageQualityHD"
            checked={config.imageQuality === 'hd'}
            onChange={(e) => onConfigChange({ imageQuality: e.target.checked ? 'hd' : 'standard' })}
            className="illuminator-checkbox"
            disabled={!config.generateImages}
          />
          <label htmlFor="imageQualityHD">HD quality (higher cost)</label>
        </div>
      </div>

      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Batch Settings</h2>
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">Batch size</label>
          <input
            type="number"
            value={config.batchSize}
            onChange={(e) => onConfigChange({ batchSize: parseInt(e.target.value) || 1 })}
            min={1}
            max={20}
            className="illuminator-input"
            style={{ width: '100px' }}
          />
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Number of tasks to process concurrently
          </p>
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">Delay between batches (ms)</label>
          <input
            type="number"
            value={config.delayBetweenBatches}
            onChange={(e) => onConfigChange({ delayBetweenBatches: parseInt(e.target.value) || 0 })}
            min={0}
            max={10000}
            step={100}
            className="illuminator-input"
            style={{ width: '100px' }}
          />
        </div>
      </div>
    </div>
  );
}
