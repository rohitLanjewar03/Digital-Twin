import { useState, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import { useNavigate } from 'react-router-dom';
import './SearchAnalyticsPage.css';

const SearchAnalyticsPage = () => {
  const { user, logout, validateSession } = useAuth();
  const [searchStats, setSearchStats] = useState(null);
  const [searchHistory, setSearchHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('month');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const navigate = useNavigate();

  // Fetch search analytics data
  const fetchSearchAnalytics = async (selectedTimeRange = 'month') => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/search/analytics?timeRange=${selectedTimeRange}`, {
        credentials: 'include'
      });

      if (response.status === 401) {
        logout();
        return;
      }

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setSearchStats(data);
    } catch (err) {
      console.error('Error fetching search analytics:', err);
      setError('Failed to load analytics data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch search history
  const fetchSearchHistory = async (pageNum = 1) => {
    try {
      const response = await fetch(`http://localhost:5000/search/history?page=${pageNum}`, {
        credentials: 'include'
      });

      if (response.status === 401) {
        logout();
        return;
      }

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setSearchHistory(data.searchHistory);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      console.error('Error fetching search history:', err);
      setError('Failed to load search history. Please try again later.');
    }
  };

  // Initial data fetch
  useEffect(() => {
    async function initialize() {
      // Validate session first
      const isValid = await validateSession();
      if (!isValid) {
        navigate('/');
        return;
      }

      // Fetch data
      fetchSearchAnalytics(timeRange);
      fetchSearchHistory(page);
    }

    if (user) {
      initialize();
    } else {
      navigate('/');
    }
  }, [user, navigate, validateSession]);

  // Handle time range change
  const handleTimeRangeChange = (e) => {
    const newTimeRange = e.target.value;
    setTimeRange(newTimeRange);
    fetchSearchAnalytics(newTimeRange);
  };

  // Handle pagination
  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchSearchHistory(newPage);
  };

  // Clear search history
  const handleClearHistory = async () => {
    try {
      const response = await fetch('http://localhost:5000/search/clear', {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to clear search history');
      }

      // Refetch data
      fetchSearchAnalytics(timeRange);
      fetchSearchHistory(1);
      setPage(1);
    } catch (err) {
      console.error('Error clearing search history:', err);
      setError('Failed to clear search history. Please try again later.');
    }
  };

  if (loading && !searchStats) {
    return <div className="loading-container">Loading analytics data...</div>;
  }

  if (error) {
    return <div className="error-container">{error}</div>;
  }

  return (
    <div className="analytics-page">
      <header className="analytics-page-header">
        <h1>Search Analytics Dashboard</h1>
        <div className="header-controls">
          <button onClick={() => navigate('/dashboard')} className="back-button">
            Back to Dashboard
          </button>
          <button onClick={logout} className="logout-button">
            Logout
          </button>
        </div>
      </header>

      <div className="analytics-controls">
        <div className="time-range-selector">
          <label htmlFor="timeRange">Time Range:</label>
          <select
            id="timeRange"
            value={timeRange}
            onChange={handleTimeRangeChange}
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="year">Last Year</option>
            <option value="all">All Time</option>
          </select>
        </div>
        <button onClick={handleClearHistory} className="clear-button">
          Clear Search History
        </button>
      </div>

      {searchStats && (
        <div className="analytics-grid">
          <div className="analytics-card category-card">
            <h2>Search Categories</h2>
            {searchStats.categories.length > 0 ? (
              <div className="category-chart">
                {searchStats.categories.map((category, index) => (
                  <div className="category-bar" key={index}>
                    <div className="category-label">{category._id}</div>
                    <div className="bar-container">
                      <div
                        className="bar"
                        style={{
                          width: `${(category.count / searchStats.categories[0].count) * 100}%`,
                        }}
                      ></div>
                      <span className="bar-value">{category.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-data">No category data available</p>
            )}
          </div>

          <div className="analytics-card topics-card">
            <h2>Popular Topics</h2>
            {searchStats.topTopics.length > 0 ? (
              <div className="topics-tag-cloud">
                {searchStats.topTopics.map((topic, index) => (
                  <span
                    key={index}
                    className="topic-tag"
                    style={{
                      fontSize: `${Math.max(100, 100 + topic.count * 20)}%`,
                      opacity: 0.6 + topic.count / (searchStats.topTopics[0].count * 2),
                    }}
                  >
                    {topic._id}
                  </span>
                ))}
              </div>
            ) : (
              <p className="no-data">No topic data available</p>
            )}
          </div>

          <div className="analytics-card trends-card">
            <h2>Search Trends</h2>
            {searchStats.searchTrends.length > 0 ? (
              <div className="trend-chart">
                {searchStats.searchTrends.map((item, index) => (
                  <div key={index} className="trend-point">
                    <div className="trend-date">{item._id}</div>
                    <div
                      className="trend-bar"
                      style={{
                        height: `${Math.min(item.count * 15, 150)}px`,
                      }}
                    >
                      <span className="trend-value">{item.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-data">No trend data available</p>
            )}
          </div>
        </div>
      )}

      <div className="search-history-section">
        <h2>Recent Searches</h2>
        {searchHistory.length > 0 ? (
          <>
            <div className="search-history-list">
              <table>
                <thead>
                  <tr>
                    <th>Query</th>
                    <th>Category</th>
                    <th>Topics</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {searchHistory.map((search) => (
                    <tr key={search._id}>
                      <td>{search.query}</td>
                      <td className="category-cell">{search.category}</td>
                      <td>
                        {search.topicTags.map((tag, i) => (
                          <span key={i} className="history-tag">
                            {tag}
                          </span>
                        ))}
                      </td>
                      <td>{new Date(search.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="pagination-button"
              >
                Previous
              </button>
              <span className="page-indicator">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="pagination-button"
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <p className="no-data">No search history available</p>
        )}
      </div>
    </div>
  );
};

export default SearchAnalyticsPage; 