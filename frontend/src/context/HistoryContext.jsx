import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './useAuth';

const HistoryContext = createContext();

export const useHistory = () => useContext(HistoryContext);

export const HistoryProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  });

  // Fetch browsing history from the server
  const fetchHistory = async (page = 1, limit = 50) => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/history?page=${page}&limit=${limit}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
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

  // Delete browsing history
  const deleteHistory = async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/history`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete history');
      }
      
      setHistory([]);
      setPagination({
        page: 1,
        limit: 50,
        total: 0,
        pages: 0
      });
    } catch (err) {
      setError(err.message);
      console.error('Error deleting history:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch history when authentication changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchHistory();
    }
  }, [isAuthenticated]);

  return (
    <HistoryContext.Provider
      value={{
        history,
        loading,
        error,
        pagination,
        fetchHistory,
        deleteHistory
      }}
    >
      {children}
    </HistoryContext.Provider>
  );
}; 