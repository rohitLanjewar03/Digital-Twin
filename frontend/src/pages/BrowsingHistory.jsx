import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import { useHistory } from '../context/HistoryContext';
import { Link } from 'react-router-dom';
import '../styles/BrowsingHistoryPage.css';

const BrowsingHistory = () => {
  const { user } = useAuth();
  const { 
    history, 
    loading, 
    error, 
    pagination, 
    lastFetched, 
    fetchHistory 
  } = useHistory();
  
  const [currentPage, setCurrentPage] = useState(1);
  
  // Use the existing data from context or fetch it if needed
  useEffect(() => {
    const page = parseInt(localStorage.getItem('browsingHistoryPage')) || 1;
    setCurrentPage(page);
    
    // Set the email in localStorage if user is logged in
    if (user?.email) {
      localStorage.setItem('browsing_history_email', user.email);
    }
  }, [user]);
  
  const handlePageChange = (page) => {
    setCurrentPage(page);
    fetchHistory(page, pagination.limit);
  };
  
  const handleRefresh = () => {
    fetchHistory(currentPage, pagination.limit, true);
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
          <Link to="/browsing-history-analytics" className="analytics-button">
            View Analytics
          </Link>
          <button 
            className="refresh-button"
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </button>
          {lastFetched && (
            <span className="last-refresh">
              Last updated: {lastFetched.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {loading && <div className="loading">Loading history...</div>}
      
      <div className={loading ? 'content-loading' : ''}>
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
      </div>
    </div>
  );
};

export default BrowsingHistory; 