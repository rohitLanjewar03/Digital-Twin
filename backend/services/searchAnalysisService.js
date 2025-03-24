/**
 * Service for analyzing search queries and extracting topic information
 */

// Common topic categories with related keywords
const topicCategories = {
  work: [
    'meeting', 'project', 'deadline', 'boss', 'colleague', 'presentation', 
    'report', 'client', 'office', 'manager', 'task', 'interview', 'job', 
    'promotion', 'resume', 'cv', 'career', 'salary', 'performance'
  ],
  finance: [
    'invoice', 'payment', 'transaction', 'bank', 'credit', 'debit', 'tax', 
    'salary', 'bill', 'receipt', 'expense', 'budget', 'investment', 'loan', 
    'financial', 'money'
  ],
  shopping: [
    'order', 'purchase', 'delivery', 'amazon', 'ebay', 'shop', 'store', 
    'product', 'item', 'shipping', 'discount', 'coupon', 'refund', 'return',
    'price', 'cost', 'buy'
  ],
  travel: [
    'flight', 'hotel', 'booking', 'reservation', 'trip', 'travel', 'vacation', 
    'itinerary', 'ticket', 'journey', 'airline', 'airport', 'checkin', 'rental',
    'accommodation', 'passport', 'visa'
  ],
  social: [
    'friend', 'family', 'party', 'event', 'celebration', 'birthday', 'wedding', 
    'invitation', 'social', 'gathering', 'dating', 'facebook', 'instagram', 
    'twitter', 'meetup'
  ],
  education: [
    'course', 'class', 'study', 'education', 'school', 'university', 'college', 
    'degree', 'certificate', 'homework', 'assignment', 'exam', 'test', 'grade', 
    'lecture', 'professor', 'student', 'learn'
  ],
  healthcare: [
    'doctor', 'medical', 'health', 'appointment', 'prescription', 'pharmacy', 
    'hospital', 'clinic', 'insurance', 'treatment', 'medication', 'therapy',
    'dental', 'vaccine', 'checkup'
  ],
  technology: [
    'software', 'hardware', 'update', 'computer', 'device', 'app', 'application', 
    'code', 'programming', 'tech', 'digital', 'system', 'laptop', 'mobile', 
    'phone', 'internet', 'website', 'data', 'password', 'account'
  ],
  entertainment: [
    'movie', 'show', 'concert', 'ticket', 'entertainment', 'music', 'video', 
    'stream', 'netflix', 'youtube', 'game', 'play', 'sport', 'event', 'subscription',
    'channel', 'podcast', 'audio', 'series'
  ],
  other: [] // Default category
};

/**
 * Analyzes a search query and returns the most likely category and topic tags
 * @param {string} query - The search query to analyze
 * @returns {Object} - Object containing category and topicTags
 */
function analyzeSearchQuery(query) {
  if (!query) {
    return { category: 'other', topicTags: [] };
  }

  const lowerQuery = query.toLowerCase();
  const words = lowerQuery.split(/\s+/);
  
  // Count matches for each category
  const categoryScores = {};
  
  for (const [category, keywords] of Object.entries(topicCategories)) {
    categoryScores[category] = 0;
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword)) {
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
  
  // Extract topic tags
  const allTopics = [];
  Object.values(topicCategories).forEach(keywords => {
    allTopics.push(...keywords);
  });
  
  const topicTags = words.filter(word => 
    word.length > 3 && allTopics.some(topic => topic.includes(word))
  );
  
  // Add the category itself as a tag if no specific tags were found
  if (topicTags.length === 0 && bestCategory !== 'other') {
    topicTags.push(bestCategory);
  }
  
  return {
    category: bestCategory,
    topicTags: [...new Set(topicTags)] // Remove duplicates
  };
}

module.exports = {
  analyzeSearchQuery
}; 