const SearchHistory = require('../models/SearchHistory');
const User = require('../models/User');
const { analyzeSearchQuery } = require('../services/searchAnalysisService');

/**
 * Record a new search query in the user's history
 */
exports.recordSearch = async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    // Get user ID from session
    const userId = req.user.id;
    
    // Analyze the search query for categorization
    const { category, topicTags } = analyzeSearchQuery(query);
    
    // Create new search history entry
    const searchEntry = new SearchHistory({
      userId,
      query,
      category,
      topicTags,
      timestamp: new Date()
    });
    
    await searchEntry.save();
    
    res.status(201).json({ 
      message: 'Search recorded successfully',
      searchId: searchEntry._id
    });
  } catch (error) {
    console.error('Error recording search:', error);
    res.status(500).json({ message: 'Failed to record search' });
  }
};

/**
 * Get search history for the current user
 */
exports.getSearchHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Get search history entries
    const searchHistory = await SearchHistory.find({ userId })
      .sort({ timestamp: -1 }) // Most recent first
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await SearchHistory.countDocuments({ userId });
    
    res.status(200).json({
      searchHistory,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching search history:', error);
    res.status(500).json({ message: 'Failed to fetch search history' });
  }
};

/**
 * Get search analytics for the current user
 */
exports.getSearchAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get time range from query params
    const timeRange = req.query.timeRange || 'all'; // 'all', 'week', 'month', 'year'
    
    // Build date filter based on time range
    const dateFilter = {};
    if (timeRange !== 'all') {
      const now = new Date();
      
      if (timeRange === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter.timestamp = { $gte: weekAgo };
      } else if (timeRange === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        dateFilter.timestamp = { $gte: monthAgo };
      } else if (timeRange === 'year') {
        const yearAgo = new Date();
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        dateFilter.timestamp = { $gte: yearAgo };
      }
    }
    
    // Build query with user ID and optional date filter
    const query = { userId, ...dateFilter };
    
    // Get category distribution
    const categoryData = await SearchHistory.aggregate([
      { $match: query },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get common topics
    const topicData = await SearchHistory.aggregate([
      { $match: query },
      { $unwind: '$topicTags' },
      { $group: { _id: '$topicTags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 } // Top 10 topics
    ]);
    
    // Get search trends over time
    const timeInterval = timeRange === 'week' ? 'day' 
                      : timeRange === 'month' ? 'day' 
                      : timeRange === 'year' ? 'month' 
                      : 'month';
    
    let dateFormat;
    if (timeInterval === 'day') {
      dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } };
    } else if (timeInterval === 'month') {
      dateFormat = { $dateToString: { format: '%Y-%m', date: '$timestamp' } };
    } else {
      dateFormat = { $dateToString: { format: '%Y', date: '$timestamp' } };
    }
    
    const trendData = await SearchHistory.aggregate([
      { $match: query },
      { 
        $group: { 
          _id: dateFormat,
          count: { $sum: 1 } 
        } 
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.status(200).json({
      timeRange,
      categories: categoryData,
      topTopics: topicData,
      searchTrends: trendData
    });
  } catch (error) {
    console.error('Error fetching search analytics:', error);
    res.status(500).json({ message: 'Failed to fetch search analytics' });
  }
};

/**
 * Clear search history for the current user
 */
exports.clearSearchHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Delete all search history for this user
    await SearchHistory.deleteMany({ userId });
    
    res.status(200).json({ message: 'Search history cleared successfully' });
  } catch (error) {
    console.error('Error clearing search history:', error);
    res.status(500).json({ message: 'Failed to clear search history' });
  }
}; 