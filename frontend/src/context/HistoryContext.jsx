import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

const HistoryContext = createContext();

export const useHistory = () => useContext(HistoryContext);

export const HistoryProvider = ({ children }) => {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 100,
    total: 0,
    pages: 0
  });
  const [lastFetched, setLastFetched] = useState(null);

  // Fetch browsing history from the server
  const fetchHistory = useCallback(async (page = 1, limit = 50, forceRefresh = false) => {
    // Get the email to use
    const email = user?.email || localStorage.getItem('browsing_history_email');
    
    // If no email is available, set error and return
    if (!email) {
      setError('Email is required to fetch browsing history');
      setLoading(false);
      return;
    }
    
    // Check if we have cached data and it's not a force refresh
    const cachedHistory = localStorage.getItem('cachedBrowsingHistory');
    const cachedTimestamp = localStorage.getItem('browsingHistoryCachedAt');
    const cachedPage = localStorage.getItem('browsingHistoryPage');
    const cachedLimit = localStorage.getItem('browsingHistoryLimit');
    const cachedEmail = localStorage.getItem('browsingHistoryEmail');
    const now = new Date().getTime();
    
    // Use cache if available, less than 5 minutes old, for the same page/limit and email
    if (!forceRefresh && 
        cachedHistory && 
        cachedTimestamp && 
        cachedPage === page.toString() &&
        cachedLimit === limit.toString() &&
        cachedEmail === email &&
        (now - parseInt(cachedTimestamp) < 5 * 60 * 1000)) {
      try {
        const parsedData = JSON.parse(cachedHistory);
        setHistory(parsedData.history);
        setPagination({
          page: parsedData.page,
          limit: parsedData.limit,
          total: parsedData.total,
          pages: parsedData.pages
        });
        setLastFetched(new Date(parseInt(cachedTimestamp)));
        return;
      } catch (err) {
        console.error('Error parsing cached browsing history:', err);
        // Continue with API fetch if cache parsing fails
      }
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`http://localhost:5000/history/by-email?email=${encodeURIComponent(email)}&page=${page}&limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch history: ${response.status} ${response.statusText}`);
      }
      
      // Try to parse the response as JSON, with better error handling
      let data;
      try {
        const responseText = await response.text();
        try {
          data = JSON.parse(responseText);
        } catch (error) {
          console.error('Response is not valid JSON:', error.message, responseText.substring(0, 200) + '...');
          throw new Error(`Server returned invalid JSON response: ${error.message}`);
        }
      } catch (textError) {
        console.error('Failed to read response:', textError);
        throw new Error('Failed to read server response');
      }
      
      // Cache the data
      localStorage.setItem('cachedBrowsingHistory', JSON.stringify(data));
      localStorage.setItem('browsingHistoryCachedAt', now.toString());
      localStorage.setItem('browsingHistoryPage', page.toString());
      localStorage.setItem('browsingHistoryLimit', limit.toString());
      localStorage.setItem('browsingHistoryEmail', email);
      
      // Save the email for future use
      localStorage.setItem('browsing_history_email', email);
      
      setHistory(data.history);
      setPagination({
        page: data.page,
        limit: data.limit,
        total: data.total,
        pages: data.pages
      });
      setLastFetched(new Date());
    } catch (err) {
      setError(err.message);
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Delete browsing history - for now this is disabled as it requires authentication
  const deleteHistory = async () => {
    setError('Delete functionality is currently disabled for public browsing history view');
  };

  // Initial fetch of history
  useEffect(() => {
    const cachedHistory = localStorage.getItem('cachedBrowsingHistory');
    if (!cachedHistory) {
      fetchHistory();
    } else {
      // Use cached data but also update in the background
      try {
        const parsedData = JSON.parse(cachedHistory);
        setHistory(parsedData.history);
        setPagination({
          page: parsedData.page,
          limit: parsedData.limit,
          total: parsedData.total,
          pages: parsedData.pages
        });
        
        // Also fetch fresh data (non-blocking)
        const cachedTimestamp = localStorage.getItem('browsingHistoryCachedAt');
        const now = new Date().getTime();
        
        // Only fetch if cache is older than 5 minutes
        if (!cachedTimestamp || (now - parseInt(cachedTimestamp) > 5 * 60 * 1000)) {
          fetchHistory(parsedData.page, parsedData.limit, true);
        }
      } catch (err) {
        console.error('Error parsing cached history:', err);
        fetchHistory();
      }
    }
  }, [fetchHistory]);

  return (
    <HistoryContext.Provider
      value={{
        history,
        loading,
        error,
        pagination,
        lastFetched,
        fetchHistory,
        deleteHistory
      }}
    >
      {children}
    </HistoryContext.Provider>
  );
}; 