function Modal({ isOpen, onClose, title, children, width = '500px' }) {
  if (!isOpen) return null;

  // Use theme colors for consistency
  const bgPrimary = '#0a1929';
  const bgSecondary = '#1e3a5f';
  const borderColor = 'rgba(59, 130, 246, 0.3)';
  const textPrimary = '#ffffff';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: bgSecondary,
          border: `1px solid ${borderColor}`,
          borderRadius: '8px',
          width: '90vw',
          maxWidth: width,
          maxHeight: '85vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: `1px solid ${borderColor}`,
          background: bgSecondary
        }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: textPrimary }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: textPrimary,
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.25rem',
              lineHeight: 1
            }}
          >×</button>
        </div>
        <div style={{ padding: '16px', overflowY: 'auto', flex: 1, background: bgSecondary }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default Modal;
