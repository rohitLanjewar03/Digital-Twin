import { useState, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import { useNavigate } from 'react-router-dom';
import './BrowsingHistoryPage.css';

const BrowsingHistoryPage = () => {
  const { user, validateSession, logout } = useAuth();
  const navigate = useNavigate();
  
  const [historyItems, setHistoryItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('7d');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState(null);
  const [testSyncLoading, setTestSyncLoading] = useState(false);
  const [testSyncSuccess, setTestSyncSuccess] = useState(false);
  const [testSyncError, setTestSyncError] = useState(null);
  
  // Fetch browsing history data
  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Validate session first
      const isValid = await validateSession();
      if (!isValid) {
        navigate("/login");
        return;
      }
      
      // Fetch history data
      const response = await fetch(
        `http://localhost:5000/history/user/${user._id}?page=${page}&category=${category}`, 
        { credentials: "include" }
      );
      
      if (response.status === 401) {
        logout();
        return;
      }
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('History data received:', data);
      
      setHistoryItems(data.historyItems || []);
      setTotalPages(data.pagination?.totalPages || 1);
      
      // Extract available categories from the data
      if (data.historyItems && data.historyItems.length > 0) {
        const categories = [...new Set(data.historyItems.map(item => item.category).filter(Boolean))];
        setCategory(categories.join(','));
      }
    } catch (err) {
      console.error("Error fetching history:", err);
      setError("Failed to load browsing history. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch analytics
  const fetchHistoryAnalytics = async () => {
    try {
      // Validate session first
      const isValid = await validateSession();
      if (!isValid) {
        navigate("/login");
        return;
      }
      
      // Fetch analytics data
      const response = await fetch(
        `http://localhost:5000/history/analytics/${user._id}?timeRange=${timeRange}`, 
        { credentials: "include" }
      );
      
      if (response.status === 401) {
        logout();
        return;
      }
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setStats(data);
      
    } catch (err) {
      console.error("Error fetching history analytics:", err);
    }
  };
  
  // Clear history
  const clearHistory = async () => {
    if (!window.confirm("Are you sure you want to clear your browsing history? This action cannot be undone.")) {
      return;
    }
    
    try {
      // Validate session first
      const isValid = await validateSession();
      if (!isValid) {
        navigate("/login");
        return;
      }
      
      // Send clear request
      const response = await fetch(
        `http://localhost:5000/history/clear/${user._id}`, 
        { 
          method: 'DELETE',
          credentials: "include" 
        }
      );
      
      if (response.status === 401) {
        logout();
        return;
      }
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
      
      // Refresh data
      fetchHistory();
      fetchHistoryAnalytics();
      
    } catch (err) {
      console.error("Error clearing history:", err);
      setError("Failed to clear browsing history. Please try again later.");
    }
  };
  
  // Initialize data on component mount
  useEffect(() => {
    if (user) {
      fetchHistory();
      fetchHistoryAnalytics();
    } else {
      navigate("/login");
    }
  }, [user, navigate]);
  
  // Update analytics when time range changes
  useEffect(() => {
    if (user) {
      fetchHistoryAnalytics();
    }
  }, [timeRange]);
  
  // Add separate effect for page and category changes
  useEffect(() => {
    if (user && historyItems.length > 0 && !testSyncSuccess) {
      fetchHistory();
    }
  }, [page, category, user]);
  
  // Handle page navigation
  const handlePrevPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };
  
  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  };
  
  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  // Format domain from URL
  const getDomain = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  };
  
  // Handle time range change
  const handleTimeRangeChange = (e) => {
    setTimeRange(e.target.value);
  };
  
  // Add this function to directly update UI with test items
  const updateUIWithTestItems = (testItems) => {
    // Map the test items to match the structure expected by the UI
    const fakeHistoryItems = testItems.map((item, index) => ({
      ...item,
      _id: `temp-${Date.now()}-${index}`,
      keywords: extractKeywordsFromTitle(item.title),
      userId: user._id
    }));
    
    // Update state with the fake items
    setHistoryItems(prevItems => {
      // Combine with existing items, avoiding duplicates by URL
      const urls = new Set(fakeHistoryItems.map(item => item.url));
      const filteredPrevItems = prevItems.filter(item => !urls.has(item.url));
      return [...fakeHistoryItems, ...filteredPrevItems];
    });
    
    // Set total pages to at least 1
    setTotalPages(Math.max(1, totalPages));
  };
  
  // Helper function to extract keywords from title
  const extractKeywordsFromTitle = (title) => {
    if (!title) return [];
    
    // Split by common separators and filter out short words
    return title.split(/[\s\-_,.$]+/)
      .filter(word => word.length > 3)
      .map(word => word.toLowerCase())
      .slice(0, 5);
  };
  
  // Update handleTestSync to use the new function
  const handleTestSync = async () => {
    setTestSyncLoading(true);
    setTestSyncSuccess(false);
    setTestSyncError(null);
    
    try {
      // Create multiple test items with different categories
      const testHistoryItems = [
        {
          url: 'https://www.example.com/test-programming',
          title: 'Programming Tutorial - Learn JavaScript',
          visitCount: 1,
          lastVisitTime: new Date().toISOString(),
          category: 'technology'
        },
        {
          url: 'https://www.example.com/test-news',
          title: 'Latest Tech News and Updates',
          visitCount: 1,
          lastVisitTime: new Date(Date.now() - 3600000).toISOString(),
          category: 'news'
        },
        {
          url: 'https://www.example.com/test-shopping',
          title: 'Online Shopping Deals',
          visitCount: 1,
          lastVisitTime: new Date(Date.now() - 7200000).toISOString(),
          category: 'shopping'
        }
      ];
      
      // Immediately update UI with test items
      updateUIWithTestItems(testHistoryItems);
      
      const response = await fetch(`http://localhost:5000/history/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user._id,
          historyItems: testHistoryItems
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Test sync successful:', data);
      setTestSyncSuccess(true);
      
      // Don't try to fetch from server after sync - we already have the test items in UI
      // try {
      //   await fetchHistory();
      // } catch (refreshError) {
      //   console.error('Error refreshing history data after sync:', refreshError);
      // }
    } catch (err) {
      console.error('Test sync failed:', err);
      setTestSyncError(err.message);
    } finally {
      setTestSyncLoading(false);
    }
  };
  
  // Render browsing history section
  const renderHistorySection = () => {
    if (isLoading) {
      return <div className="loading-message">Loading browsing history...</div>;
    }
    
    if (error) {
      return <div className="error-message">{error}</div>;
    }
    
    if (!historyItems || historyItems.length === 0) {
      return (
        <div className="empty-history">
          <h3>No Browsing History Found</h3>
          <p>There are several possible reasons for this:</p>
          <ul>
            <li>You haven't browsed any websites with the extension installed</li>
            <li>The browser extension is not connected to your account</li>
            <li>The synchronization process hasn't completed yet</li>
          </ul>
          <div className="test-sync-container">
            <button 
              className="test-sync-button" 
              onClick={handleTestSync}
              disabled={testSyncLoading}
            >
              {testSyncLoading ? 'Syncing...' : 'Test Sync (Add Sample Data)'}
            </button>
            {testSyncSuccess && <p className="success-message">Test sync successful! Refreshing data...</p>}
            {testSyncError && <p className="error-message">Test sync failed: {testSyncError}</p>}
          </div>
          <div className="extension-help">
            <p>
              <a href="#" onClick={() => window.open('extension.html', '_blank')}>
                Need help with the extension?
              </a>
            </p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="history-items-container">
        <h2>Browsing History</h2>
        
        <div className="history-list">
          {historyItems.map((item) => (
            <div className="history-item" key={item._id}>
              <div className="item-main">
                <div className="item-title">{item.title || 'No Title'}</div>
                <a className="item-url" href={item.url} target="_blank" rel="noopener noreferrer">
                  {getDomain(item.url)}
                </a>
              </div>
              <div className="item-meta">
                <div className="item-category">{item.category}</div>
                <div className="item-visit">
                  <span className="visit-count">{item.visitCount} {item.visitCount === 1 ? 'visit' : 'visits'}</span>
                  <span className="visit-time">Last visit: {formatDate(item.lastVisitTime)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="pagination">
          <button 
            onClick={handlePrevPage} 
            disabled={page === 1}
            className="pagination-button"
          >
            Previous
          </button>
          <span className="page-number">Page {page} of {totalPages}</span>
          <button 
            onClick={handleNextPage} 
            disabled={page === totalPages}
            className="pagination-button"
          >
            Next
          </button>
        </div>
      </div>
    );
  };
  
  return (
    <div className="browsing-history-page">
      <header className="history-page-header">
        <h1>Your Browsing History</h1>
        <div className="header-actions">
          <button className="back-button" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
          <button className="logout-button" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <div className="history-controls">
        <div className="filters">
          <div className="filter-group">
            <label>Time Range:</label>
            <select 
              value={timeRange} 
              onChange={handleTimeRangeChange}
            >
              <option value="1d">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Category:</label>
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="shopping">Shopping</option>
              <option value="travel">Travel</option>
              <option value="technology">Technology</option>
              <option value="news">News</option>
              <option value="social">Social</option>
              <option value="education">Education</option>
              <option value="entertainment">Entertainment</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <button 
            className="clear-history-button" 
            onClick={clearHistory}
          >
            Clear History
          </button>
        </div>
      </div>
      
      <div className="history-analytics">
        {stats ? (
          <div className="analytics-grid">
            <div className="analytics-card">
              <h3>Browse Categories</h3>
              <div className="category-list">
                {stats.categories.map((category, index) => (
                  <div className="category-item" key={index}>
                    <span className="category-name">{category._id || 'Uncategorized'}</span>
                    <span className="category-count">{category.count}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="analytics-card">
              <h3>Top Domains</h3>
              <div className="domain-list">
                {stats.topDomains.map((domain, index) => (
                  <div className="domain-item" key={index}>
                    <span className="domain-name">{domain._id || 'Unknown'}</span>
                    <span className="domain-count">{domain.count}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="analytics-card">
              <h3>Keywords</h3>
              <div className="keyword-cloud">
                {stats.topKeywords.map((keyword, index) => (
                  <span 
                    className="keyword-tag" 
                    key={index}
                    style={{
                      fontSize: `${Math.max(0.8, Math.min(1.5, 0.8 + (keyword.count / 10) * 0.7))}em`,
                      opacity: 0.7 + (keyword.count / (stats.topKeywords[0].count * 2))
                    }}
                  >
                    {keyword._id}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="analytics-card full-width">
              <h3>Visit Trends</h3>
              <div className="trend-chart">
                {stats.visitTrends.map((item, index) => (
                  <div className="trend-bar" key={index}>
                    <div 
                      className="bar" 
                      style={{ 
                        height: `${Math.min(100, (item.count / Math.max(...stats.visitTrends.map(t => t.count))) * 100)}%` 
                      }}
                    />
                    <div className="date">{item._id}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="loading-analytics">Loading analytics...</div>
        )}
      </div>
      
      {renderHistorySection()}
    </div>
  );
};

export default BrowsingHistoryPage; 