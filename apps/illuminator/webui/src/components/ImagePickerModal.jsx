/**
 * ImagePickerModal - Browse and select an image from the library
 *
 * Used to assign existing images to entities instead of generating new ones.
 * Shows all images in the library with filtering by entity kind and culture.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  searchImages,
  getImageFilterOptions,
  loadImage,
  formatBytes,
} from '../../../../canonry/webui/src/storage/imageStore';

/**
 * Format a timestamp to a readable date string
 */
function formatDate(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ImagePickerModal({
  isOpen,
  onClose,
  onSelect,
  entityKind,
  entityCulture,
  currentImageId,
}) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [thumbnailUrls, setThumbnailUrls] = useState({});
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [filterKind, setFilterKind] = useState('all');
  const [filterCulture, setFilterCulture] = useState('all');
  const [filterModel, setFilterModel] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [expandedPrompt, setExpandedPrompt] = useState(null);
  const [filterOptions, setFilterOptions] = useState({ kinds: [], cultures: [], models: [] });

  // Load filter options when modal opens
  useEffect(() => {
    if (!isOpen) return;

    async function loadFilterOptions() {
      try {
        const [kinds, cultures, models] = await Promise.all([
          getImageFilterOptions('entityKind'),
          getImageFilterOptions('entityCulture'),
          getImageFilterOptions('model'),
        ]);
        setFilterOptions({ kinds, cultures, models });
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    }

    loadFilterOptions();
    // Reset filters on open
    setFilterKind('all');
    setFilterCulture('all');
    setFilterModel('all');
    setSearchText('');
  }, [isOpen]);

  // Load images when filters change
  useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      setLoading(true);
      try {
        const filters = {};
        if (filterKind !== 'all') filters.entityKind = filterKind;
        if (filterCulture !== 'all') filters.entityCulture = filterCulture;
        if (filterModel !== 'all') filters.model = filterModel;
        if (searchText.trim()) filters.searchText = searchText.trim();

        const results = await searchImages(filters);
        setImages(results);
      } catch (err) {
        console.error('Failed to load images:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isOpen, filterKind, filterCulture, filterModel, searchText]);

  // Load thumbnail URLs for visible images
  useEffect(() => {
    if (!isOpen || images.length === 0) return;

    const loadThumbnails = async () => {
      const newUrls = {};

      for (const img of images) {
        if (!thumbnailUrls[img.imageId]) {
          try {
            const result = await loadImage(img.imageId);
            if (result?.url) {
              newUrls[img.imageId] = result.url;
            }
          } catch {
            // Ignore errors
          }
        }
      }

      if (Object.keys(newUrls).length > 0) {
        setThumbnailUrls((prev) => ({ ...prev, ...newUrls }));
      }
    };

    loadThumbnails();

    // Cleanup URLs on close
    return () => {
      if (!isOpen) {
        for (const url of Object.values(thumbnailUrls)) {
          URL.revokeObjectURL(url);
        }
      }
    };
  }, [isOpen, images]);


  // Handle selection
  const handleSelect = useCallback(() => {
    if (selectedImageId && onSelect) {
      // Find the selected image to get its metadata
      const selectedImage = images.find((img) => img.imageId === selectedImageId);
      onSelect(selectedImageId, selectedImage);
    }
    onClose();
  }, [selectedImageId, images, onSelect, onClose]);

  // Handle close
  const handleClose = useCallback(() => {
    setSelectedImageId(null);
    setExpandedPrompt(null);
    onClose();
  }, [onClose]);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div className="illuminator-modal-overlay" onClick={handleClose}>
      <div
        className="illuminator-modal"
        style={{ maxWidth: '900px', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="illuminator-modal-header">
          <h3>Select Image from Library</h3>
          <button onClick={handleClose} className="illuminator-modal-close">&times;</button>
        </div>

        <div className="illuminator-modal-body" style={{ padding: '0' }}>
          {/* Filters */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '16px',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-tertiary)',
          }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Search
              </label>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Name or prompt..."
                className="illuminator-input"
                style={{ width: '160px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Entity Kind
              </label>
              <select
                value={filterKind}
                onChange={(e) => setFilterKind(e.target.value)}
                className="illuminator-select"
                style={{ width: 'auto', minWidth: '120px' }}
              >
                <option value="all">All Kinds</option>
                {filterOptions.kinds.map((kind) => (
                  <option key={kind} value={kind}>{kind}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Culture
              </label>
              <select
                value={filterCulture}
                onChange={(e) => setFilterCulture(e.target.value)}
                className="illuminator-select"
                style={{ width: 'auto', minWidth: '120px' }}
              >
                <option value="all">All Cultures</option>
                {filterOptions.cultures.map((culture) => (
                  <option key={culture} value={culture}>{culture}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Model
              </label>
              <select
                value={filterModel}
                onChange={(e) => setFilterModel(e.target.value)}
                className="illuminator-select"
                style={{ width: 'auto', minWidth: '120px' }}
              >
                <option value="all">All Models</option>
                {filterOptions.models.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>

            <div style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {images.length} images
              </span>
            </div>
          </div>

          {/* Image grid */}
          <div style={{ padding: '16px', maxHeight: '500px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading images...
              </div>
            ) : images.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No images found. Try adjusting the filters or generate some images first.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '12px',
                }}
              >
                {images.map((img) => {
                  const isSelected = selectedImageId === img.imageId;
                  const isCurrent = currentImageId === img.imageId;

                  return (
                    <div
                      key={img.imageId}
                      onClick={() => setSelectedImageId(img.imageId)}
                      style={{
                        position: 'relative',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: isSelected
                          ? '2px solid var(--accent-color)'
                          : isCurrent
                          ? '2px solid var(--success)'
                          : '2px solid transparent',
                        opacity: isCurrent ? 0.7 : 1,
                      }}
                    >
                      {/* Current badge */}
                      {isCurrent && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '6px',
                            right: '6px',
                            zIndex: 1,
                            padding: '2px 6px',
                            background: 'var(--success)',
                            color: 'white',
                            borderRadius: '3px',
                            fontSize: '9px',
                            fontWeight: 600,
                          }}
                        >
                          CURRENT
                        </div>
                      )}

                      {/* Thumbnail */}
                      <div
                        style={{
                          width: '100%',
                          paddingTop: '100%',
                          position: 'relative',
                        }}
                      >
                        {thumbnailUrls[img.imageId] ? (
                          <img
                            src={thumbnailUrls[img.imageId]}
                            alt={img.entityName || img.imageId}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--text-muted)',
                              fontSize: '11px',
                            }}
                          >
                            Loading...
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ padding: '8px' }}>
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={img.entityName}
                        >
                          {img.entityName || 'Unknown'}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {img.entityKind}
                          {img.entityCulture && ` · ${img.entityCulture}`}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {formatDate(img.generatedAt)} · {formatBytes(img.size || 0)}
                        </div>

                        {/* Prompt preview */}
                        {(img.finalPrompt || img.originalPrompt) && (
                          <div
                            style={{
                              marginTop: '6px',
                              padding: '4px 6px',
                              background: 'rgba(0,0,0,0.2)',
                              borderRadius: '4px',
                              fontSize: '9px',
                              color: 'var(--text-muted)',
                              maxHeight: expandedPrompt === img.imageId ? '200px' : '40px',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              transition: 'max-height 0.2s ease',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedPrompt(expandedPrompt === img.imageId ? null : img.imageId);
                            }}
                            title="Click to expand/collapse prompt"
                          >
                            {img.finalPrompt || img.originalPrompt}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="illuminator-modal-footer" style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
          <button onClick={handleClose} className="illuminator-btn">
            Cancel
          </button>
          <button
            onClick={handleSelect}
            disabled={!selectedImageId || selectedImageId === currentImageId}
            className="illuminator-btn illuminator-btn-primary"
          >
            {selectedImageId === currentImageId ? 'Already Assigned' : 'Assign Image'}
          </button>
        </div>
      </div>
    </div>
  );
}
