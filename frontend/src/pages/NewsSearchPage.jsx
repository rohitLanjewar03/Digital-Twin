import { useState, useEffect } from 'react';
import '../styles/NewsSearchPage.css';
import defaultNewsImage from '../assets/default-news.js';

const NewsSearchPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newsResults, setNewsResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [searchStartTime, setSearchStartTime] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Popular topics for suggested searches
  const popularTopics = [
    'Technology', 'Sports', 'Politics', 'Business', 
    'Climate Change', 'Health', 'Science', 'Entertainment'
  ];
  
  // Track last searched queries for quick re-search
  const [recentSearches, setRecentSearches] = useState([]);
  
  useEffect(() => {
    let interval;
    
    if (isLoading) {
      // Reset progress and set start time
      setLoadingProgress(0);
      setSearchStartTime(Date.now());
      
      // Simulate progress to give user feedback while waiting for API
      interval = setInterval(() => {
        // Progress should reach ~70% over 5 seconds, then slow down
        // This creates perception of progress while waiting for actual results
        setLoadingProgress(prev => {
          const elapsed = Date.now() - searchStartTime;
          
          if (prev < 70 && elapsed < 5000) {
            return prev + (100 - prev) * 0.05;
          } else if (prev < 90) {
            return prev + (100 - prev) * 0.01;
          }
          return prev;
        });
      }, 200);
    } else {
      // Set to 100% when loading completes
      if (loadingProgress > 0) {
        setLoadingProgress(100);
      }
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading, searchStartTime]);
  
  const addToRecentSearches = (query) => {
    if (!query) return;
    
    setRecentSearches(prev => {
      // Filter out this query if it exists and limit to last 5 searches
      const filtered = prev.filter(item => item !== query);
      return [query, ...filtered].slice(0, 5);
    });
  };
  
  // Handle search form submission
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    
    if (!searchQuery.trim()) {
      setError('Please enter a search topic');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSearching(true);
    addToRecentSearches(searchQuery);
    
    try {
      const response = await fetch('http://localhost:5000/news/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.articles && Array.isArray(data.articles)) {
        setNewsResults(data.articles);
        setLastUpdated(new Date());
      } else {
        throw new Error('Invalid response format or no articles found');
      }
    } catch (err) {
      console.error('Error fetching news:', err);
      setError(`Failed to fetch news: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRecentSearchClick = (query) => {
    setSearchQuery(query);
    // Use setTimeout to ensure state update before search
    setTimeout(() => {
      handleSearch();
    }, 0);
  };
  
  const handleSuggestedTopicClick = (topic) => {
    setSearchQuery(topic);
    setTimeout(() => {
      handleSearch();
    }, 0);
  };
  
  // Format date for display with relative time if recent
  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      
      const now = new Date();
      const diffInHours = Math.abs(now - date) / 36e5; // Convert ms to hours
      
      // If less than 24 hours ago, show relative time
      if (diffInHours < 24) {
        if (diffInHours < 1) {
          const minutes = Math.round(diffInHours * 60);
          return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
        }
        const hours = Math.round(diffInHours);
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
      }
      
      // If less than 7 days ago, show day of week
      if (diffInHours < 168) { // 7 days * 24 hours
        const options = { weekday: 'long' };
        return date.toLocaleDateString(undefined, options);
      }
      
      // Otherwise show full date
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return '';
    }
  };
  
  // Function to handle image loading errors
  const handleImageError = (e) => {
    e.target.onerror = null; // Prevent infinite error loop
    
    // Try to extract source and title for better placeholder
    let parentArticle = null;
    for (const article of newsResults) {
      if (article.imageUrl === e.target.src) {
        parentArticle = article;
        break;
      }
    }
    
    if (parentArticle) {
      // Create a dynamic placeholder with article info
      const source = encodeURIComponent(parentArticle.source || 'News');
      const title = encodeURIComponent((parentArticle.title || '').substring(0, 50));
      e.target.src = `https://via.placeholder.com/500x300/f0f0f0/333333?text=${source}:+${title}`;
    } else {
      // Use default fallback
      e.target.src = defaultNewsImage;
    }
    
    // Add class to style the fallback properly
    e.target.classList.add('fallback-image');
  };
  
  // Render a fallback image placeholder
  const renderImageFallback = (article) => {
    // Use article info to create a more relevant placeholder if possible
    let imgSrc = defaultNewsImage;
    
    if (article) {
      const source = encodeURIComponent(article.source || 'News');
      const title = encodeURIComponent((article.title || '').substring(0, 50));
      imgSrc = `https://via.placeholder.com/500x300/f0f0f0/333333?text=${source}:+${title}`;
    }
    
    return (
      <div className="article-image">
        <img 
          src={imgSrc}
          alt="No image available"
          className="fallback-image-content"
        />
      </div>
    );
  };
  
  // Check if the article is recent (published after Jan 1, 2025)
  const isRecentArticle = (dateString) => {
    if (!dateString) return false;
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return false;
      
      // Jan 1, 2025
      const jan2025 = new Date(2025, 0, 1);
      return date >= jan2025;
    } catch {
      return false;
    }
  };
  
  return (
    <div className="news-search-page">
      <header className="news-search-header">
        <h1>Latest News Search</h1>
        <p>Search for the latest news articles from reliable sources</p>
      </header>
      
      <div className="search-container">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter a news topic (e.g., 'climate change', 'technology', 'sports')"
            className="search-input"
          />
          <button 
            type="submit" 
            className="search-button"
            disabled={isLoading}
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </form>
        
        {error && <div className="error-message">{error}</div>}
        
        {recentSearches.length > 0 && (
          <div className="recent-searches">
            <span>Recent:</span>
            {recentSearches.map((query, index) => (
              <button 
                key={index} 
                className="recent-search-btn"
                onClick={() => handleRecentSearchClick(query)}
                disabled={isLoading}
              >
                {query}
              </button>
            ))}
          </div>
        )}
      </div>
      
      <div className="news-results-container">
        {isLoading ? (
          <div className="loading-container">
            <div className="progress-container">
              <div 
                className="progress-bar" 
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
            <div className="loading-spinner"></div>
            <p className="loading-message">
              {loadingProgress < 30 ? 'Contacting news sources...' : 
               loadingProgress < 60 ? 'Finding the latest articles...' : 
               loadingProgress < 90 ? 'Preparing your results...' : 
               'Almost ready...'}
            </p>
            <p className="loading-tip">
              News results are cached for 5 minutes. Repeat searches will load much faster!
            </p>
          </div>
        ) : !searching ? (
          <div className="start-search-prompt">
            <div className="prompt-icon">🔍</div>
            <h2>Enter a topic to get started</h2>
            <p>Get the latest news from reliable sources</p>
            
            <div className="suggested-topics">
              <h3>Popular Topics</h3>
              <div className="topic-buttons">
                {popularTopics.map((topic, index) => (
                  <button
                    key={index}
                    className="topic-button"
                    onClick={() => handleSuggestedTopicClick(topic)}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : newsResults.length === 0 ? (
          <div className="no-results">
            <h2>No news found</h2>
            <p>Try a different search term or check back later</p>
          </div>
        ) : (
          <>
            <div className="results-meta">
              <div className="api-source">
                Source: <span className="source-name">NewsAPI</span>
                <span className="source-badge">Official</span>
              </div>
              <div className="results-meta-details">
                <div className="results-count">
                  Found {newsResults.length} articles
                </div>
                {lastUpdated && (
                  <div className="last-updated">
                    Updated: {formatDate(lastUpdated)}
                  </div>
                )}
              </div>
            </div>
            
            <div className="filter-options">
              <span className="filter-label">Date:</span>
              <button 
                className="filter-btn"
                onClick={() => setNewsResults(prev => 
                  [...prev].sort((a, b) => 
                    new Date(b.publishedDate || 0) - new Date(a.publishedDate || 0)
                  )
                )}
              >
                Newest First
              </button>
            </div>
            
            <div className="news-articles">
              {newsResults.map((article, index) => (
                <div 
                  className={`news-article-card ${isRecentArticle(article.publishedDate) ? 'recent-article' : ''}`} 
                  key={index}
                >
                  {article.imageUrl ? (
                    <div className="article-image">
                      <img 
                        src={article.imageUrl} 
                        alt={article.title}
                        onError={handleImageError}
                      />
                    </div>
                  ) : renderImageFallback(article)}
                  
                  <div className="article-content">
                    <div className="article-meta">
                      {article.source && (
                        <p className="article-source">
                          {article.source}
                          {article.publishedDate && (
                            <span className="article-date">
                              {formatDate(article.publishedDate)}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    
                    <h3 className="article-title">
                      {article.url ? (
                        <a href={article.url} target="_blank" rel="noopener noreferrer">
                          {article.title}
                        </a>
                      ) : (
                        article.title
                      )}
                    </h3>
                    
                    <p className="article-summary">{article.summary}</p>
                    
                    {article.url && (
                      <a 
                        href={article.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="read-more-link"
                      >
                        Read more →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NewsSearchPage; 