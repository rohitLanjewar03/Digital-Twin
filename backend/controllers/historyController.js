const BrowsingHistory = require('../models/BrowsingHistory');
const User = require('../models/User');
const { analyzeHistoryItem } = require('../services/historyAnalysisService');

/**
 * Sync browsing history from the extension
 */
exports.syncHistory = async (req, res) => {
  try {
    const { userId, historyItems } = req.body;
    
    if (!userId || !historyItems || !Array.isArray(historyItems)) {
      return res.status(400).json({ message: 'Invalid request data' });
    }
    
    // Validate userId exists in our database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Process each history item
    const results = {
      added: 0,
      updated: 0,
      filtered: 0
    };
    
    for (const item of historyItems) {
      // Basic validation
      if (!item.url) {
        results.filtered++;
        continue;
      }
      
      // Check if this URL already exists for this user
      const existingItem = await BrowsingHistory.findOne({
        userId: user._id,
        url: item.url
      });
      
      // Analyze the URL and title
      const { category, keywords } = analyzeHistoryItem(item.url, item.title);
      
      if (existingItem) {
        // Update existing record
        existingItem.visitCount += 1;
        existingItem.lastVisitTime = new Date(item.lastVisitTime || Date.now());
        existingItem.syncTime = new Date();
        
        // Update category and keywords if previously empty
        if (existingItem.category === 'other' && category !== 'other') {
          existingItem.category = category;
        }
        
        if (!existingItem.keywords || existingItem.keywords.length === 0) {
          existingItem.keywords = keywords;
        }
        
        await existingItem.save();
        results.updated++;
      } else {
        // Create new record
        const newHistoryItem = new BrowsingHistory({
          userId: user._id,
          url: item.url,
          title: item.title || '',
          visitCount: item.visitCount || 1,
          lastVisitTime: new Date(item.lastVisitTime || Date.now()),
          syncTime: new Date(),
          category,
          keywords
        });
        
        await newHistoryItem.save();
        results.added++;
      }
    }
    
    res.status(200).json({
      message: 'History sync completed successfully',
      results
    });
    
  } catch (error) {
    console.error('Error syncing history:', error);
    res.status(500).json({ message: 'Failed to sync history data' });
  }
};

/**
 * Get user's browsing history
 */
exports.getUserHistory = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Validate userId exists in our database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    // Apply category filter if provided
    const filter = { userId: user._id };
    if (req.query.category && req.query.category !== 'all') {
      filter.category = req.query.category;
    }
    
    // Get browsing history items
    const historyItems = await BrowsingHistory.find(filter)
      .sort({ lastVisitTime: -1 }) // Most recent first
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await BrowsingHistory.countDocuments(filter);
    
    res.status(200).json({
      historyItems,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ message: 'Failed to fetch browsing history' });
  }
};

/**
 * Get browsing history analytics
 */
exports.getHistoryAnalytics = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Validate userId exists in our database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get time range from query params
    const timeRange = req.query.timeRange || 'all'; // 'all', 'week', 'month', 'year'
    
    // Build date filter based on time range
    const dateFilter = {};
    if (timeRange !== 'all') {
      const now = new Date();
      
      if (timeRange === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter.lastVisitTime = { $gte: weekAgo };
      } else if (timeRange === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        dateFilter.lastVisitTime = { $gte: monthAgo };
      } else if (timeRange === 'year') {
        const yearAgo = new Date();
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        dateFilter.lastVisitTime = { $gte: yearAgo };
      }
    }
    
    // Build query with user ID and optional date filter
    const query = { userId: user._id, ...dateFilter };
    
    // Get category distribution
    const categoryData = await BrowsingHistory.aggregate([
      { $match: query },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get top domains
    const domainData = await BrowsingHistory.aggregate([
      { $match: query },
      { 
        $project: {
          domain: {
            $arrayElemAt: [
              { $split: [
                { $arrayElemAt: [{ $split: ['$url', '://'] }, 1] },
                '/'
              ] },
              0
            ]
          }
        }
      },
      { $group: { _id: '$domain', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Get visit trends over time
    const timeInterval = timeRange === 'week' ? 'day' 
                      : timeRange === 'month' ? 'day' 
                      : timeRange === 'year' ? 'month' 
                      : 'month';
    
    let dateFormat;
    if (timeInterval === 'day') {
      dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$lastVisitTime' } };
    } else if (timeInterval === 'month') {
      dateFormat = { $dateToString: { format: '%Y-%m', date: '$lastVisitTime' } };
    } else {
      dateFormat = { $dateToString: { format: '%Y', date: '$lastVisitTime' } };
    }
    
    const trendData = await BrowsingHistory.aggregate([
      { $match: query },
      { 
        $group: { 
          _id: dateFormat,
          count: { $sum: 1 } 
        } 
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Get top keywords
    const keywordData = await BrowsingHistory.aggregate([
      { $match: query },
      { $unwind: '$keywords' },
      { $group: { _id: '$keywords', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 }
    ]);
    
    res.status(200).json({
      timeRange,
      categories: categoryData,
      topDomains: domainData,
      visitTrends: trendData,
      topKeywords: keywordData
    });
    
  } catch (error) {
    console.error('Error fetching history analytics:', error);
    res.status(500).json({ message: 'Failed to fetch browsing history analytics' });
  }
};

/**
 * Clear browsing history for a user
 */
exports.clearHistory = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Validate userId exists in our database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Delete all history for this user
    await BrowsingHistory.deleteMany({ userId: user._id });
    
    res.status(200).json({ message: 'Browsing history cleared successfully' });
    
  } catch (error) {
    console.error('Error clearing history:', error);
    res.status(500).json({ message: 'Failed to clear browsing history' });
  }
};

/**
 * Validate if a user exists
 */
exports.validateUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json({ 
      valid: true,
      userId: user._id,
      email: user.email
    });
    
  } catch (error) {
    console.error('Error validating user:', error);
    res.status(500).json({ message: 'Failed to validate user' });
  }
};

/**
 * Health check endpoint for the extension
 */
exports.healthCheck = (req, res) => {
  res.status(200).json({ status: 'ok' });
}; 