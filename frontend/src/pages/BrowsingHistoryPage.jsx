import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import '../styles/BrowsingHistoryPage.css';

function fetchHistory(page = 1) {
  // You may want to get the email from localStorage or context if needed
  const email = localStorage.getItem('browsing_history_email');
  if (!email) return Promise.reject('Email is required to fetch browsing history');
  return fetch(`http://localhost:5000/history/by-email?email=${encodeURIComponent(email)}&page=${page}&limit=50`)
    .then(res => {
      if (!res.ok) throw new Error('Failed to fetch history');
      return res.json();
    });
}

const BrowsingHistoryPage = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['history', currentPage],
    queryFn: () => fetchHistory(currentPage),
    keepPreviousData: true,
    staleTime: 5 * 60 * 1000,
  });

  const history = data?.history || [];
  const pagination = data || { page: 1, limit: 50, total: 0, pages: 1 };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleDeleteHistory = () => {
    // Placeholder for delete logic
    setConfirmDelete(false);
  };

  const renderPagination = () => {
    const pages = [];
    const totalPages = pagination.pages;
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    if (endPage - startPage < maxVisible - 1) {
      if (startPage === 1) {
        endPage = Math.min(totalPages, startPage + maxVisible - 1);
      } else if (endPage === totalPages) {
        startPage = Math.max(1, endPage - maxVisible + 1);
      }
    }

    // Debug output
    console.log('Pagination debug:', { currentPage, totalPages, startPage, endPage });

    // Always show first page
    if (startPage > 1) {
      pages.push(
        <button key={1} className={`pagination-button ${currentPage === 1 ? 'active' : ''}`} onClick={() => handlePageChange(1)}>
          1
        </button>
      );
      if (startPage > 2) {
        pages.push(<span key="start-ellipsis" className="pagination-ellipsis">...</span>);
      }
    }

    // Main page numbers
    for (let i = startPage; i <= endPage; i++) {
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

    // Always show last page
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push(<span key="end-ellipsis" className="pagination-ellipsis">...</span>);
      }
      pages.push(
        <button key={totalPages} className={`pagination-button ${currentPage === totalPages ? 'active' : ''}`} onClick={() => handlePageChange(totalPages)}>
          {totalPages}
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
          disabled={currentPage === totalPages}
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
            onClick={() => refetch()}
            disabled={isLoading}
          >
            Refresh
          </button>
          <button 
            className={`delete-button ${confirmDelete ? 'confirm' : ''}`}
            onClick={handleDeleteHistory}
            disabled={isLoading || history.length === 0}
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
      {error && <div className="error-message">{error.message || error}</div>}
      {isLoading ? (
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