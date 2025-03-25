import React, { useEffect, useState } from 'react';
import { useHistory } from '../context/HistoryContext';
import '../styles/BrowsingHistoryPage.css';

const BrowsingHistoryPage = () => {
  const { 
    history, 
    loading, 
    error, 
    pagination, 
    fetchHistory, 
    deleteHistory 
  } = useHistory();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(false);
  
  useEffect(() => {
    document.title = 'Browsing History';
    fetchHistory(currentPage);
  }, [currentPage]);
  
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };
  
  const handleDeleteHistory = () => {
    if (confirmDelete) {
      deleteHistory();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
    }
  };
  
  const renderPagination = () => {
    const pages = [];
    for (let i = 1; i <= pagination.pages; i++) {
      pages.push(
        <button 
          key={i} 
          className={`pagination-button ${i === currentPage ? 'active' : ''}`}
          onClick={() => handlePageChange(i)}
        >
          {i}
        </button>
      );
    }
    
    return (
      <div className="pagination">
        <button 
          className="pagination-button" 
          disabled={currentPage === 1}
          onClick={() => handlePageChange(currentPage - 1)}
        >
          Previous
        </button>
        
        {pages}
        
        <button 
          className="pagination-button" 
          disabled={currentPage === pagination.pages}
          onClick={() => handlePageChange(currentPage + 1)}
        >
          Next
        </button>
      </div>
    );
  };
  
  return (
    <div className="browsing-history-page">
      <div className="header">
        <h1>Browsing History</h1>
        <div className="actions">
          <button 
            className="refresh-button"
            onClick={() => fetchHistory(currentPage)}
            disabled={loading}
          >
            Refresh
          </button>
          
          <button 
            className={`delete-button ${confirmDelete ? 'confirm' : ''}`}
            onClick={handleDeleteHistory}
            disabled={loading || history.length === 0}
          >
            {confirmDelete ? 'Confirm Delete' : 'Delete All History'}
          </button>
          
          {confirmDelete && (
            <button 
              className="cancel-button"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {loading ? (
        <div className="loading">Loading history...</div>
      ) : (
        <>
          {history.length === 0 ? (
            <div className="empty-history">
              <p>No browsing history found.</p>
              <p>Install our browser extension to collect your browsing history.</p>
              <a href="#" className="extension-link">
                Get Browser Extension
              </a>
            </div>
          ) : (
            <>
              <div className="history-stats">
                <p>Showing {history.length} of {pagination.total} history items</p>
              </div>
              
              <div className="history-list">
                {history.map((item, index) => (
                  <div key={index} className="history-item">
                    <h3>{item.title || 'No Title'}</h3>
                    <a 
                      href={item.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      {item.url}
                    </a>
                    <div className="item-details">
                      <span>Visited: {new Date(item.lastVisitTime).toLocaleString()}</span>
                      <span>Visit count: {item.visitCount}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              {pagination.pages > 1 && renderPagination()}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default BrowsingHistoryPage; 