/**
 * Service for analyzing browsing history data
 */

const url = require('url');

// Common categories with related keywords
const categories = {
  shopping: [
    'amazon', 'ebay', 'walmart', 'shop', 'buy', 'purchase', 'product', 'price',
    'deal', 'sale', 'discount', 'order', 'cart', 'checkout', 'shipping', 'etsy'
  ],
  travel: [
    'booking', 'hotel', 'flight', 'trip', 'vacation', 'travel', 'expedia', 'airbnb', 
    'airline', 'reserve', 'destination', 'resort', 'ticket', 'accommodation',
    'trip', 'kayak', 'tripadvisor'
  ],
  technology: [
    'github', 'stack overflow', 'code', 'programming', 'javascript', 'python', 
    'developer', 'api', 'software', 'tech', 'computer', 'gadget', 'app', 
    'cloud', 'data', 'server', 'dev'
  ],
  news: [
    'news', 'article', 'headline', 'report', 'politics', 'cnn', 'bbc', 'reuters',
    'nytimes', 'washingtonpost', 'fox news', 'guardian', 'journalist'
  ],
  social: [
    'facebook', 'twitter', 'instagram', 'linkedin', 'tiktok', 'social', 'friend',
    'post', 'share', 'follow', 'comment', 'like', 'message', 'chat', 'profile'
  ],
  education: [
    'course', 'learn', 'university', 'college', 'school', 'education', 'study',
    'tutorial', 'lesson', 'teacher', 'student', 'class', 'academic', 'training',
    'udemy', 'coursera', 'edx', 'khan academy'
  ],
  entertainment: [
    'youtube', 'netflix', 'movie', 'show', 'music', 'spotify', 'stream', 'video',
    'play', 'game', 'entertainment', 'watch', 'hulu', 'disney', 'sport'
  ],
  other: [] // Default category
};

/**
 * Analyzes a URL and title to categorize and extract keywords
 * @param {string} urlStr - The URL to analyze
 * @param {string} title - The page title
 * @returns {Object} - Object with category and keywords
 */
function analyzeHistoryItem(urlStr, title) {
  if (!urlStr) {
    return { category: 'other', keywords: [] };
  }
  
  // Parse URL
  const parsedUrl = url.parse(urlStr);
  const hostname = parsedUrl.hostname || '';
  
  // Combine URL and title for analysis
  const combinedText = (hostname + ' ' + (title || '')).toLowerCase();
  
  // Count matches for each category
  const categoryScores = {};
  
  for (const [category, keywords] of Object.entries(categories)) {
    categoryScores[category] = 0;
    for (const keyword of keywords) {
      if (combinedText.includes(keyword.toLowerCase())) {
        categoryScores[category]++;
      }
    }
  }
  
  // Find category with highest score
  let bestCategory = 'other';
  let highestScore = 0;
  
  for (const [category, score] of Object.entries(categoryScores)) {
    if (score > highestScore) {
      highestScore = score;
      bestCategory = category;
    }
  }
  
  // Extract keywords
  const keywords = new Set();
  
  // Add domain without TLD as a keyword
  const domain = hostname.split('.').slice(0, -1).join('.');
  if (domain) keywords.add(domain);
  
  // Extract keywords from title
  if (title) {
    const words = title.toLowerCase().split(/\s+/);
    for (const word of words) {
      // Only include meaningful words (longer than 3 chars)
      if (word.length > 3 && !isCommonWord(word)) {
        keywords.add(word);
      }
    }
  }
  
  // Add category itself as a keyword
  if (bestCategory !== 'other') {
    keywords.add(bestCategory);
  }
  
  return {
    category: bestCategory,
    keywords: Array.from(keywords).slice(0, 10) // Limit to 10 keywords
  };
}

// Common words to filter out
const commonWords = [
  'the', 'and', 'for', 'that', 'this', 'with', 'are', 'from', 'have', 'you',
  'was', 'not', 'were', 'they', 'but', 'has', 'can', 'their', 'what', 'all', 
  'one', 'been', 'our', 'who', 'will', 'would', 'should', 'could', 'page'
];

function isCommonWord(word) {
  return commonWords.includes(word);
}

module.exports = {
  analyzeHistoryItem
}; 