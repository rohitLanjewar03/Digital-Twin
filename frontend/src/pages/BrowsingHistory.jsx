import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import '../styles/BrowsingHistoryPage.css';

const BrowsingHistory = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  });
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch history when component mounts or page changes
  useEffect(() => {
    fetchHistory(currentPage);
  }, [currentPage]);
  
  const fetchHistory = async (page = currentPage) => {
    setLoading(true);
    setError(null);
    
    try {
      // Get email from user context or localStorage
      let email = '';
      
      if (user && user.email) {
        email = user.email;
      } else {
        // Try to get from localStorage as fallback
        const savedEmail = localStorage.getItem('browsing_history_email');
        if (savedEmail) {
          email = savedEmail;
        }
      }
      
      if (!email) {
        setLoading(false);
        setError('No user found. Please log in to view your browsing history.');
        return;
      }
      
      const response = await fetch(`http://localhost:5000/history/by-email?email=${encodeURIComponent(email)}&page=${page}&limit=50`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }
      
      const data = await response.json();
      setHistory(data.history);
      setPagination({
        page: data.page,
        limit: data.limit,
        total: data.total,
        pages: data.pages
      });
    } catch (err) {
      setError(err.message);
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handlePageChange = (page) => {
    setCurrentPage(page);
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
  
  const getUserEmail = () => {
    if (user && user.email) return user.email;
    return localStorage.getItem('browsing_history_email') || 'your account';
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
        </div>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {loading ? (
        <div className="loading">Loading history...</div>
      ) : (
        <>
          {history.length === 0 ? (
            <div className="empty-history">
              <p>No browsing history found for {getUserEmail()}.</p>
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

export default BrowsingHistory; 