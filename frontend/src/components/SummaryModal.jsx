import React, { useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import '../styles/SummaryModal.css';

const SummaryModal = ({ isOpen, onClose, title, summary, isLoading, error, url }) => {
  const { theme } = useTheme();
  const modalRef = useRef(null);
  
  // Close modal on escape key press or outside click
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    const handleOutsideClick = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscapeKey);
    document.addEventListener('mousedown', handleOutsideClick);
    
    // Prevent scrolling when modal is open
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.removeEventListener('mousedown', handleOutsideClick);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);
  
  // Format the summary text with proper paragraphs
  const formatSummary = (text) => {
    if (!text) return '';
    
    // Split by double newlines or single newlines
    const paragraphs = text.split(/\n\n|\n/).filter(p => p.trim());
    
    return (
      <>
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </>
    );
  };
  
  // If modal is not open, don't render anything
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay">
      <div 
        className="summary-modal" 
        data-theme={theme}
        ref={modalRef}
      >
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-content">
          {isLoading ? (
            <div className="modal-loading">
              <div className="loading-spinner"></div>
              <p>Generating AI summary...</p>
            </div>
          ) : error ? (
            <div className="modal-error">
              <p>{error}</p>
            </div>
          ) : summary ? (
            <>
              <div className="summary-content">
                {formatSummary(summary)}
              </div>
              {url && (
                <div className="modal-footer">
                  <a 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="read-original-btn"
                  >
                    Read original article
                  </a>
                </div>
              )}
            </>
          ) : (
            <div className="modal-loading">
              <p>Waiting for summary...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SummaryModal;
