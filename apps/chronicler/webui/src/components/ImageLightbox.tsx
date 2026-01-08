import { useEffect, useCallback, useRef } from 'react';
import type { MouseEvent } from 'react';

interface ImageLightboxProps {
  isOpen: boolean;
  imageUrl: string | null;
  title: string;
  summary?: string;
  onClose: () => void;
}

export default function ImageLightbox({
  isOpen,
  imageUrl,
  title,
  summary,
  onClose,
}: ImageLightboxProps) {
  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.88)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        zIndex: 10000,
      }}
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Image viewer'}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '20px',
          right: '24px',
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '6px',
          color: '#ffffff',
          padding: '8px 14px',
          cursor: 'pointer',
          fontSize: '13px',
        }}
      >
        Close
      </button>
      <div
        style={{
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <img
          src={imageUrl}
          alt={title || 'Expanded view'}
          style={{
            maxWidth: '100%',
            maxHeight: '70vh',
            objectFit: 'contain',
            borderRadius: '10px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.55)',
          }}
        />
        <div
          style={{
            width: '100%',
            maxWidth: '820px',
            textAlign: 'center',
            color: 'rgba(255, 255, 255, 0.92)',
            display: 'grid',
            gap: '8px',
          }}
        >
          {title && (
            <div style={{ fontSize: '18px', fontWeight: 600 }}>{title}</div>
          )}
          {summary && (
            <div style={{
              fontSize: '14px',
              lineHeight: 1.6,
              maxHeight: '20vh',
              overflowY: 'auto',
            }}>
              {summary}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
