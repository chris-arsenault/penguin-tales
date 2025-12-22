/**
 * ImageModal - Full-size image viewer
 *
 * Opens when clicking on an image thumbnail to show the full image.
 * Loads images from local IndexedDB storage by imageId.
 */

import { useEffect, useCallback } from 'react';
import { useImageUrl } from '../hooks/useImageUrl';

export default function ImageModal({ isOpen, imageId, title, onClose }) {
  const { url: imageUrl, loading, error, metadata } = useImageUrl(isOpen ? imageId : null);
  // Close on escape key
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '40px',
      }}
      onClick={onClose}
    >
      {/* Header with title and close button */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0, color: 'white', fontSize: '16px' }}>{title}</h3>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '4px',
            color: 'white',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Close (Esc)
        </button>
      </div>

      {/* Image */}
      {loading ? (
        <div
          style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '16px',
          }}
        >
          Loading image...
        </div>
      ) : error || !imageUrl ? (
        <div
          style={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '14px',
            textAlign: 'center',
          }}
        >
          <div style={{ marginBottom: '8px' }}>Image not available</div>
          <div style={{ fontSize: '12px' }}>{error || 'Image not found in storage'}</div>
        </div>
      ) : (
        <img
          src={imageUrl}
          alt={title}
          style={{
            maxWidth: '100%',
            maxHeight: 'calc(100vh - 120px)',
            objectFit: 'contain',
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          }}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Hint at bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: '12px',
        }}
      >
        Click anywhere or press Escape to close
      </div>
    </div>
  );
}
