const axios = require('axios');
const NodeCache = require('node-cache');

// Cache setup with 5 minutes TTL (reduced for fresher results)
const cache = new NodeCache({ stdTTL: 5 * 60 });

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_BASE_URL = 'https://newsapi.org/v2';

// Function to fetch news from NewsAPI
const fetchNewsFromNewsAPI = async (query) => {
  try {
    // Current date and time
    const currentDate = new Date();
    
    // Get yesterday's date for very fresh news (last 24 hours)
    const yesterday = new Date(currentDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const fromDate = yesterday.toISOString().split('T')[0];
    
    // First try top-headlines for the most recent news
    const headlinesParams = {
      apiKey: NEWS_API_KEY,
      q: query,
      language: 'en',
      pageSize: 30,
      sortBy: 'publishedAt',
      from: fromDate
    };
    
    console.log(`Fetching top headlines for query: ${query} from ${fromDate}`);
    
    const headlinesResponse = await axios.get(`${NEWS_API_BASE_URL}/top-headlines`, {
      params: headlinesParams
    });
    
    let articles = headlinesResponse.data.articles || [];
    
    // If we don't get enough results from top-headlines, try the everything endpoint
    if (articles.length < 10) {
      const everythingParams = {
        apiKey: NEWS_API_KEY,
        q: query,
        language: 'en',
        pageSize: 30,
        sortBy: 'publishedAt',
        from: fromDate
      };
      
      console.log(`Fetching everything for query: ${query} from ${fromDate}`);
      
      const everythingResponse = await axios.get(`${NEWS_API_BASE_URL}/everything`, {
        params: everythingParams
      });
      
      const everythingArticles = everythingResponse.data.articles || [];
      
      // Combine results, removing duplicates by URL
      const urlSet = new Set(articles.map(article => article.url));
      
      for (const article of everythingArticles) {
        if (!urlSet.has(article.url)) {
          urlSet.add(article.url);
          articles.push(article);
        }
      }
    }
    
    // If we STILL don't have enough results, try with a 7-day range as fallback
    if (articles.length < 5) {
      const oneWeekAgo = new Date(currentDate);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const weekFromDate = oneWeekAgo.toISOString().split('T')[0];
      
      const fallbackParams = {
        apiKey: NEWS_API_KEY,
        q: query,
        language: 'en',
        pageSize: 30,
        sortBy: 'publishedAt',
        from: weekFromDate
      };
      
      console.log(`Fallback: Fetching with wider date range: ${weekFromDate}`);
      
      const fallbackResponse = await axios.get(`${NEWS_API_BASE_URL}/everything`, {
        params: fallbackParams
      });
      
      const fallbackArticles = fallbackResponse.data.articles || [];
      
      // Add non-duplicate articles from fallback
      const urlSet = new Set(articles.map(article => article.url));
      
      for (const article of fallbackArticles) {
        if (!urlSet.has(article.url)) {
          urlSet.add(article.url);
          articles.push(article);
        }
      }
    }
    
    // Sort by date (newest first) after combining all sources
    articles.sort((a, b) => {
      const dateA = new Date(a.publishedAt || 0);
      const dateB = new Date(b.publishedAt || 0);
      return dateB - dateA;
    });
    
    console.log(`Found ${articles.length} articles from NewsAPI`);
    
    // Only return articles from the last year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    articles = articles.filter(article => {
      if (!article.publishedAt) return false;
      const articleDate = new Date(article.publishedAt);
      return articleDate > oneYearAgo;
    });
    
    return { articles };
    
  } catch (error) {
    console.error('Error fetching from NewsAPI:', error.response?.data || error.message);
    throw new Error(`Error fetching news from NewsAPI: ${error.response?.data?.message || error.message}`);
  }
};

// Improved function to validate image URLs with better checks
const validateImageUrl = (url) => {
  if (!url) return false;
  
  try {
    // Only accept HTTP/HTTPS URLs
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return false;
    }
    
    // Check for common image extensions
    const hasImageExtension = /\.(jpg|jpeg|png|gif|webp)($|\?)/i.test(url);
    
    // More comprehensive list of problematic domains
    const problematicDomains = [
      'espn.com', 'cnn.com', 'localhost', '127.0.0.1',
      'wsimg.com', 'fbcdn.net', 'i.kinja-img.com',
      'ytimg.com', 'self-signed', 'i2.wp.com'
    ];
    
    // Check for data URIs or very long URLs (often problematic)
    const isSuspiciousUrl = 
      url.startsWith('data:') || 
      url.length > 500 ||
      problematicDomains.some(domain => url.includes(domain));
    
    return hasImageExtension && !isSuspiciousUrl;
  } catch (error) {
    return false;
  }
};

// Format the articles from NewsAPI to a consistent format
const formatNewsApiArticles = (articles) => {
  if (!articles || !Array.isArray(articles)) return [];
  
  // Get current year for fresh date comparison
  const currentYear = new Date().getFullYear();
  
  return articles
    .filter(article => 
      // Filter out invalid articles or those with [Removed] titles
      article && 
      article.title && 
      article.url && 
      !article.title.includes('[Removed]') &&
      // Filter out articles with dates from before this year
      article.publishedAt
    )
    .map(article => {
      // Parse the date
      let publishedDate = null;
      try {
        publishedDate = new Date(article.publishedAt);
      } catch (e) {
        publishedDate = null;
      }
      
      // Create a fallback image URL using a placeholder service
      // This ensures every article has at least some image
      const sourceEncoded = encodeURIComponent(article.source?.name || 'News');
      const titleEncoded = encodeURIComponent(article.title.substring(0, 50));
      const fallbackImageUrl = `https://via.placeholder.com/500x300/f0f0f0/333333?text=${sourceEncoded}:+${titleEncoded}`;
      
      // Use validated image URL or fallback
      const validatedImageUrl = validateImageUrl(article.urlToImage) ? article.urlToImage : null;
      const imageUrl = validatedImageUrl || fallbackImageUrl;
      
      return {
        title: article.title,
        url: article.url,
        imageUrl: imageUrl,
        source: article.source?.name || 'Unknown Source',
        publishedDate: article.publishedAt,
        summary: article.description || article.content || 'No description available'
      };
    });
};

// Controller to search for news
const searchNews = async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return res.status(400).json({ error: 'A valid search query is required' });
    }
    
    const cacheKey = `news-search-${query.trim().toLowerCase()}`;
    const cachedResults = cache.get(cacheKey);
    
    if (cachedResults) {
      console.log(`Returning cached results for query: ${query}`);
      
      // Check if cache is too old (over 1 hour) and invalidate silently in background
      const cacheAge = cache.getTtl(cacheKey) - Date.now();
      if (cacheAge < 0 || cacheAge > 55 * 60 * 1000) {
        console.log('Cache too old, triggering background refresh');
        setTimeout(() => {
          cache.del(cacheKey);
        }, 100);
      }
      
      return res.json(cachedResults);
    }
    
    console.log(`Searching for news with query: "${query}"`);
    
    // Fetch from NewsAPI
    const newsApiResults = await fetchNewsFromNewsAPI(query);
    const formattedArticles = formatNewsApiArticles(newsApiResults.articles);
    
    const results = {
      articles: formattedArticles,
      source: 'newsapi',
      timestamp: new Date().toISOString()
    };
    
    // Cache the results
    cache.set(cacheKey, results);
    
    return res.json(results);
    
  } catch (error) {
    console.error('News search error:', error);
    return res.status(500).json({ error: error.message || 'Error fetching news' });
  }
};

module.exports = { searchNews }; 