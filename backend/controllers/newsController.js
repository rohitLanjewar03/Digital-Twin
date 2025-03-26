const axios = require('axios');
const NodeCache = require('node-cache');
const { OpenAI } = require('openai');
const BrowsingHistory = require('../models/BrowsingHistory');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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

// Helper function to safely parse JSON from OpenAI responses
const safeJSONParse = (text) => {
  try {
    // First attempt direct parsing
    return JSON.parse(text);
  } catch (error) {
    try {
      // Check if response is wrapped in markdown code blocks
      if (text.includes('```json') || text.includes('```')) {
        // Extract content between code blocks
        let jsonContent = text.replace(/^```json\s+/, '').replace(/^```\s+/, '').replace(/\s+```$/, '');
        return JSON.parse(jsonContent);
      }
      
      // Try to find JSON-like content in the text
      const jsonMatch = text.match(/(\{[\s\S]*\})/);
      if (jsonMatch && jsonMatch[0]) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Could not parse JSON from response');
    } catch (innerError) {
      console.error('JSON parsing error:', innerError);
      throw new Error(`Failed to parse JSON: ${innerError.message}`);
    }
  }
};

// Utility function to validate if a URL is an image
const validateImageUrl = (url) => {
  if (!url) return false;
  
  try {
    const validImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const lowerUrl = url.toLowerCase();
    
    // Check if the URL has any of the valid image extensions
    const hasImageExtension = validImageExtensions.some(ext => lowerUrl.includes(ext));
    
    // Check if URL is valid (starts with http/https)
    const isValidUrl = url.startsWith('http://') || url.startsWith('https://');
    
    return isValidUrl && (hasImageExtension || lowerUrl.includes('image'));
  } catch (e) {
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

/**
 * Extract relevant topics from user browsing history using OpenAI
 * @param {Array} historyItems - User's browsing history items
 * @returns {Array} Array of relevant topics for news search
 */
const extractTopicsFromHistory = async (historyItems) => {
  try {
    // Limit to most recent 50 history items to avoid token limits
    const recentItems = [...historyItems]
      .sort((a, b) => new Date(b.lastVisitTime) - new Date(a.lastVisitTime))
      .slice(0, 50);
    
    // Format history data for OpenAI
    const historyData = recentItems.map(item => ({
      url: item.url,
      title: item.title || 'No Title'
    }));
    
    // Use OpenAI to extract relevant topics
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are an expert news recommendation system. 
          Analyze the user's browsing history and extract 5-7 specific topics that would make good news search queries. 
          Focus on extracting current interests, events, people, or technologies the user has shown interest in.
          Return ONLY raw JSON without markdown formatting, code blocks, or any explanatory text.`
        },
        {
          role: "user",
          content: `Analyze this browsing history and identify 5-7 specific topics that would make good news search queries.
          
          Return your results in this JSON format:
          {
            "topics": [
              {
                "query": "specific search query",
                "relevance": 0-10 score,
                "category": "general category (tech, sports, entertainment, etc.)",
                "explanation": "brief explanation of why this is relevant to the user"
              }
            ],
            "primaryInterests": ["interest1", "interest2"]
          }
          
          Here is the browsing history data:
          ${JSON.stringify(historyData, null, 2)}`
        }
      ],
      temperature: 0.7,
    });
    
    // Parse the response
    const result = safeJSONParse(response.choices[0].message.content);
    return result;
  } catch (error) {
    console.error('Error extracting topics from history:', error);
    // Fallback to default topics if OpenAI fails
    return {
      topics: [
        { query: "technology news", relevance: 8, category: "technology" },
        { query: "world news today", relevance: 7, category: "news" }
      ],
      primaryInterests: ["General News", "Technology"]
    };
  }
};

/**
 * Controller to get personalized news recommendations based on user's browsing history
 */
const getRecommendedNews = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userId = req.user._id;
    const cacheKey = `news-recommendations-${userId}`;
    
    // Check if we have cached recommendations
    const cachedResults = cache.get(cacheKey);
    if (cachedResults) {
      console.log(`Returning cached news recommendations for user: ${userId}`);
      return res.json(cachedResults);
    }
    
    // Get user's browsing history
    const userHistory = await BrowsingHistory.findOne({ user: userId });
    
    if (!userHistory || userHistory.history.length === 0) {
      return res.status(404).json({ 
        error: 'No browsing history available for recommendations',
        recommendations: [] 
      });
    }
    
    // Extract topics from browsing history
    const topicsResult = await extractTopicsFromHistory(userHistory.history);
    
    // Get top topics sorted by relevance
    const sortedTopics = topicsResult.topics.sort((a, b) => b.relevance - a.relevance);
    
    // Get news for each topic (limit to top 3 topics)
    const topicPromises = sortedTopics.slice(0, 3).map(async (topic) => {
      try {
        const newsResults = await fetchNewsFromNewsAPI(topic.query);
        const formattedArticles = formatNewsApiArticles(newsResults.articles).slice(0, 5); // Limit to 5 articles per topic
        
        return {
          topic: topic.query,
          category: topic.category,
          explanation: topic.explanation,
          articles: formattedArticles
        };
      } catch (error) {
        console.error(`Error fetching news for topic ${topic.query}:`, error);
        return {
          topic: topic.query,
          category: topic.category,
          explanation: topic.explanation,
          articles: [],
          error: error.message
        };
      }
    });
    
    // Wait for all topic news to be fetched
    const topicNews = await Promise.all(topicPromises);
    
    // Construct the response
    const recommendations = {
      timestamp: new Date().toISOString(),
      primaryInterests: topicsResult.primaryInterests,
      recommendedTopics: topicNews.filter(topic => topic.articles.length > 0)
    };
    
    // Cache the results
    cache.set(cacheKey, recommendations, 30 * 60); // Cache for 30 minutes
    
    return res.json(recommendations);
  } catch (error) {
    console.error('Error getting news recommendations:', error);
    return res.status(500).json({ error: error.message || 'Error fetching news recommendations' });
  }
};

module.exports = { searchNews, getRecommendedNews }; 