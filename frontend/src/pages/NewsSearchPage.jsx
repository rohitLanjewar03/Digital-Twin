import { useState, useEffect, useRef } from 'react';
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
  const [recommendations, setRecommendations] = useState(null);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [recommendationError, setRecommendationError] = useState(null);
  
  // Popular topics for suggested searches
  const popularTopics = [
    'Technology', 'Sports', 'Politics', 'Business', 
    'Climate Change', 'Health', 'Science', 'Entertainment'
  ];
  
  // Track last searched queries for quick re-search
  const [recentSearches, setRecentSearches] = useState([]);
  
  // Ref to track if component is mounted
  const isMounted = useRef(true);
  
  // Fetch personalized recommendations on component mount
  useEffect(() => {
    fetchRecommendations();
    
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Fetch personalized news recommendations based on browsing history
  const fetchRecommendations = async () => {
    setLoadingRecommendations(true);
    setRecommendationError(null);
    
    try {
      const response = await fetch('http://localhost:5000/news/recommended', {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (isMounted.current) {
        setRecommendations(data);
      }
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      if (isMounted.current) {
        setRecommendationError(`Failed to load recommendations: ${err.message}`);
      }
    } finally {
      if (isMounted.current) {
        setLoadingRecommendations(false);
      }
    }
  };
  
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
  
  // Use a recommendation topic as a search query
  const handleRecommendationClick = (topic) => {
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
  
  // Check if an article is recent (published within the last 48 hours)
  const isRecentArticle = (dateString) => {
    if (!dateString) return false;
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return false;
      
      const now = new Date();
      const diffInHours = Math.abs(now - date) / 36e5; // Convert ms to hours
      
      return diffInHours < 48;
    } catch {
      return false;
    }
  };
  
  // Render personalized recommendations section
  const renderRecommendations = () => {
    if (loadingRecommendations) {
      return (
        <div className="recommendations-loading">
          <div className="loading-spinner"></div>
          <p>Loading personalized recommendations...</p>
        </div>
      );
    }
    
    if (recommendationError) {
      return (
        <div className="recommendations-error">
          <p>{recommendationError}</p>
          <button onClick={fetchRecommendations} className="retry-button">
            Retry
          </button>
        </div>
      );
    }
    
    if (!recommendations || !recommendations.recommendedTopics || recommendations.recommendedTopics.length === 0) {
      return (
        <div className="no-recommendations">
          <p>No personalized recommendations available yet. Browse more websites to improve recommendations.</p>
        </div>
      );
    }
    
    return (
      <div className="recommendations-container">
        <h2>Personalized Recommendations</h2>
        <p className="recommendations-description">
          Based on your browsing history, we recommend these topics:
        </p>
        
        <div className="recommendation-topics">
          {recommendations.primaryInterests?.map((interest, index) => (
            <span key={index} className="interest-tag">{interest}</span>
          ))}
        </div>
        
        {recommendations.recommendedTopics.map((topicData, index) => (
          <div key={index} className="recommendation-section">
            <div className="recommendation-header">
              <h3>{topicData.topic}</h3>
              <span className="category-tag">{topicData.category}</span>
              <button 
                className="view-more-btn" 
                onClick={() => handleRecommendationClick(topicData.topic)}
              >
                View more
              </button>
            </div>
            
            <p className="recommendation-explanation">{topicData.explanation}</p>
            
            <div className="recommendation-articles">
              {topicData.articles.slice(0, 3).map((article, articleIndex) => (
                <div key={articleIndex} className="recommendation-article">
                  <div className="article-image-container">
                    <img 
                      src={article.imageUrl} 
                      alt={article.title}
                      onError={handleImageError}
                      className="article-image"
                    />
                    {isRecentArticle(article.publishedDate) && (
                      <span className="recent-tag">New</span>
                    )}
                  </div>
                  <div className="article-content">
                    <h4 className="article-title">
                      <a 
                        href={article.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        {article.title}
                      </a>
                    </h4>
                    <div className="article-meta">
                      <span className="source">{article.source}</span>
                      <span className="date">{formatDate(article.publishedDate)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  return (
    <div className="news-search-page">
      <h1>News Search</h1>
      
      <div className="search-container">
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-container">
            <input
              type="text"
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for news topics..."
            />
            <button 
              type="submit" 
              className="search-button"
              disabled={isLoading}
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>
        
        {isLoading && (
          <div className="progress-container">
            <div 
              className="progress-bar" 
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
        )}
      </div>
      
      <div className="search-suggestions">
        {recentSearches.length > 0 && (
          <div className="recent-searches">
            <h3>Recent Searches</h3>
            <div className="topic-tags">
              {recentSearches.map((query, index) => (
                <button 
                  key={index}
                  className="topic-tag"
                  onClick={() => handleRecentSearchClick(query)}
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div className="popular-topics">
          <h3>Popular Topics</h3>
          <div className="topic-tags">
            {popularTopics.map((topic, index) => (
              <button 
                key={index}
                className="topic-tag"
                onClick={() => handleSuggestedTopicClick(topic)}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {!searching && !isLoading && (
        <div className="recommended-section">
          {renderRecommendations()}
        </div>
      )}
      
      <div className="results-container">
        {error && <div className="error-message">{error}</div>}
        
        {searching && newsResults.length === 0 && !isLoading && !error && (
          <div className="no-results">
            <p>No results found for "{searchQuery}"</p>
            <p>Try different keywords or browse our suggestions above.</p>
          </div>
        )}
        
        {searching && newsResults.length > 0 && (
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
            
            <div className="news-results">
              {newsResults.map((article, index) => (
                <div key={index} className="news-article">
                  <div className="article-image-container">
                    <img 
                      src={article.imageUrl} 
                      alt={article.title}
                      onError={handleImageError}
                      className="article-image"
                    />
                    {isRecentArticle(article.publishedDate) && (
                      <span className="recent-tag">New</span>
                    )}
                  </div>
                  <div className="article-content">
                    <h2 className="article-title">
                      <a 
                        href={article.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        {article.title}
                      </a>
                    </h2>
                    <div className="article-meta">
                      <span className="source">{article.source}</span>
                      <span className="date">{formatDate(article.publishedDate)}</span>
                    </div>
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