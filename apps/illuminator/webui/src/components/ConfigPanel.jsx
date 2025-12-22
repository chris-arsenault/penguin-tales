/**
 * ConfigPanel - Model and API configuration
 *
 * Contains settings for:
 * - Model selection (text and image)
 * - Image size and quality options (model-specific)
 * - Multishot prompting options
 */

const TEXT_MODELS = [
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (faster)' },
];

const IMAGE_MODELS = [
  { value: 'gpt-image-1.5', label: 'GPT Image 1.5' },
  { value: 'gpt-image-1', label: 'GPT Image 1' },
  { value: 'dall-e-3', label: 'DALL-E 3' },
  { value: 'dall-e-2', label: 'DALL-E 2 (cheaper)' },
];

const DEFAULT_IMAGE_PROMPT_TEMPLATE = `Reformat the below prompt into something appropriate for generating a {{modelName}} image of an entity. Avoid bestiary/manuscript/folio style pages - instead create artwork that directly represents the subject as if they exist in the world.

Original prompt:
{{prompt}}`;

// Model-specific size options
const IMAGE_SIZES_BY_MODEL = {
  'gpt-image-1.5': [
    { value: 'auto', label: 'Auto' },
    { value: '1024x1024', label: '1024x1024 (Square)' },
    { value: '1536x1024', label: '1536x1024 (Landscape)' },
    { value: '1024x1536', label: '1024x1536 (Portrait)' },
  ],
  'gpt-image-1': [
    { value: 'auto', label: 'Auto' },
    { value: '1024x1024', label: '1024x1024 (Square)' },
    { value: '1536x1024', label: '1536x1024 (Landscape)' },
    { value: '1024x1536', label: '1024x1536 (Portrait)' },
  ],
  'dall-e-3': [
    { value: '1024x1024', label: '1024x1024 (Square)' },
    { value: '1792x1024', label: '1792x1024 (Landscape)' },
    { value: '1024x1792', label: '1024x1792 (Portrait)' },
  ],
  'dall-e-2': [
    { value: '1024x1024', label: '1024x1024' },
    { value: '512x512', label: '512x512' },
    { value: '256x256', label: '256x256' },
  ],
};

// Model-specific quality options
const IMAGE_QUALITY_BY_MODEL = {
  'gpt-image-1.5': [
    { value: 'auto', label: 'Auto' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ],
  'gpt-image-1': [
    { value: 'auto', label: 'Auto' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ],
  'dall-e-3': [
    { value: 'standard', label: 'Standard' },
    { value: 'hd', label: 'HD' },
  ],
  'dall-e-2': [
    { value: 'standard', label: 'Standard' },
  ],
};

function isGptImageModel(model) {
  return model?.startsWith('gpt-image');
}

export default function ConfigPanel({ config, onConfigChange }) {
  const sizeOptions = IMAGE_SIZES_BY_MODEL[config.imageModel] || IMAGE_SIZES_BY_MODEL['dall-e-3'];
  const qualityOptions = IMAGE_QUALITY_BY_MODEL[config.imageModel] || IMAGE_QUALITY_BY_MODEL['dall-e-3'];

  // When model changes, reset size and quality to first valid option for that model
  const handleModelChange = (newModel) => {
    const newSizes = IMAGE_SIZES_BY_MODEL[newModel] || IMAGE_SIZES_BY_MODEL['dall-e-3'];
    const newQualities = IMAGE_QUALITY_BY_MODEL[newModel] || IMAGE_QUALITY_BY_MODEL['dall-e-3'];

    const updates = { imageModel: newModel };

    // Reset size if current value isn't valid for new model
    if (!newSizes.some((s) => s.value === config.imageSize)) {
      updates.imageSize = newSizes[0].value;
    }

    // Reset quality if current value isn't valid for new model
    if (!newQualities.some((q) => q.value === config.imageQuality)) {
      updates.imageQuality = newQualities[0].value;
    }

    onConfigChange(updates);
  };

  return (
    <div>
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Text Generation</h2>
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">Model (Anthropic)</label>
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
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Used for entity descriptions, era narratives, and relationship stories.
          </p>
        </div>
      </div>

      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Image Generation</h2>
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">Model (OpenAI)</label>
          <select
            value={config.imageModel}
            onChange={(e) => handleModelChange(e.target.value)}
            className="illuminator-select"
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
          >
            {sizeOptions.map((size) => (
              <option key={size.value} value={size.value}>
                {size.label}
              </option>
            ))}
          </select>
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">Quality</label>
          <select
            value={config.imageQuality}
            onChange={(e) => onConfigChange({ imageQuality: e.target.value })}
            className="illuminator-select"
          >
            {qualityOptions.map((quality) => (
              <option key={quality.value} value={quality.value}>
                {quality.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Multishot Prompting</h2>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Improve image generation by chaining multiple AI calls.
        </p>

        <div className="illuminator-checkbox-group" style={{ marginBottom: '12px' }}>
          <input
            type="checkbox"
            id="requireDescription"
            checked={config.requireDescription || false}
            onChange={(e) => onConfigChange({ requireDescription: e.target.checked })}
            className="illuminator-checkbox"
          />
          <label htmlFor="requireDescription">Require description before image</label>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px', marginLeft: '24px' }}>
          Enforces description generation before image generation. The description will be included in the image prompt.
        </p>

        <div className="illuminator-checkbox-group" style={{ marginBottom: '12px' }}>
          <input
            type="checkbox"
            id="useClaudeForImagePrompt"
            checked={config.useClaudeForImagePrompt || false}
            onChange={(e) => onConfigChange({ useClaudeForImagePrompt: e.target.checked })}
            className="illuminator-checkbox"
          />
          <label htmlFor="useClaudeForImagePrompt">Use Claude to format image prompt</label>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', marginLeft: '24px' }}>
          Sends the image prompt through Claude first to optimize it for the image model.
        </p>

        {config.useClaudeForImagePrompt && (
          <div className="illuminator-form-group" style={{ marginLeft: '24px' }}>
            <label className="illuminator-label">Claude formatting prompt</label>
            <textarea
              value={config.claudeImagePromptTemplate || DEFAULT_IMAGE_PROMPT_TEMPLATE}
              onChange={(e) => onConfigChange({ claudeImagePromptTemplate: e.target.value })}
              className="illuminator-template-textarea"
              placeholder={DEFAULT_IMAGE_PROMPT_TEMPLATE}
            />
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Use {'{{modelName}}'} for the image model name and {'{{prompt}}'} for the original prompt.
            </p>
          </div>
        )}
      </div>

      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Performance</h2>
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">Parallel workers</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="range"
              min="1"
              max="8"
              value={config.numWorkers || 4}
              onChange={(e) => onConfigChange({ numWorkers: parseInt(e.target.value, 10) })}
              style={{ flex: 1 }}
            />
            <span style={{ minWidth: '24px', textAlign: 'right', fontWeight: 500 }}>
              {config.numWorkers || 4}
            </span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Number of concurrent API calls. Higher = faster but may hit rate limits.
          </p>
        </div>
      </div>

      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">About</h2>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Illuminator enriches your world simulation with LLM-generated content.
          Use the <strong>Entities</strong> tab to generate descriptions and images for entities.
          Use the <strong>Narratives</strong> tab to generate era summaries and relationship stories.
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6, marginTop: '12px' }}>
          All enrichments are saved automatically to your current world slot.
        </p>
      </div>
    </div>
  );
}
