const BrowsingHistory = require('../models/BrowsingHistory');
const historyAnalysisService = require('../services/historyAnalysisService');

/**
 * Save browsing history data from the extension
 */
exports.saveHistory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { history } = req.body;
    
    if (!history || !Array.isArray(history)) {
      return res.status(400).json({ error: 'Invalid history data format' });
    }

    // Process the history items to ensure proper format
    const processedHistory = history.map(item => ({
      url: item.url,
      title: item.title || 'No Title',
      visitCount: item.visitCount || 1,
      lastVisitTime: new Date(item.lastVisitTime)
    }));

    // Find existing history for this user or create a new one
    let userHistory = await BrowsingHistory.findOne({ user: req.user._id });

    if (userHistory) {
      // Update existing history
      // For each new history item:
      // - If URL exists, update visit count and time
      // - If URL is new, add to history array
      
      const existingUrls = new Set(userHistory.history.map(item => item.url));
      
      processedHistory.forEach(newItem => {
        const existingItemIndex = userHistory.history.findIndex(
          item => item.url === newItem.url
        );
        
        if (existingItemIndex >= 0) {
          // Update existing item
          const existingItem = userHistory.history[existingItemIndex];
          userHistory.history[existingItemIndex] = {
            ...existingItem.toObject(),
            visitCount: Math.max(existingItem.visitCount, newItem.visitCount),
            lastVisitTime: new Date(Math.max(
              existingItem.lastVisitTime.getTime(),
              newItem.lastVisitTime.getTime()
            ))
          };
        } else {
          // Add new item
          userHistory.history.push(newItem);
        }
      });
      
      userHistory.lastUpdated = new Date();
      await userHistory.save();
    } else {
      // Create new history record
      userHistory = new BrowsingHistory({
        user: req.user._id,
        history: processedHistory,
        lastUpdated: new Date()
      });
      
      await userHistory.save();
    }

    return res.status(200).json({ 
      success: true, 
      message: 'History saved successfully',
      count: userHistory.history.length
    });
  } catch (error) {
    console.error('Error saving browsing history:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get the user's browsing history
 */
exports.getHistory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Parse query parameters
    const limit = parseInt(req.query.limit) || 100;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    
    // Get user history
    const userHistory = await BrowsingHistory.findOne({ user: req.user._id });
    
    if (!userHistory) {
      return res.status(200).json({ 
        history: [],
        total: 0,
        page,
        limit,
        pages: 0
      });
    }

    // Sort history by lastVisitTime (most recent first)
    const sortedHistory = userHistory.history
      .sort((a, b) => b.lastVisitTime - a.lastVisitTime);
    
    // Apply pagination
    const paginatedHistory = sortedHistory.slice(skip, skip + limit);
    const total = sortedHistory.length;
    const pages = Math.ceil(total / limit);

    return res.status(200).json({
      history: paginatedHistory,
      total,
      page,
      limit,
      pages
    });
  } catch (error) {
    console.error('Error getting browsing history:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Delete browsing history
 */
exports.deleteHistory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    await BrowsingHistory.findOneAndDelete({ user: req.user._id });

    return res.status(200).json({ 
      success: true, 
      message: 'History deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting browsing history:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get browsing history by email (for testing)
 * This endpoint doesn't require authentication
 */
exports.getHistoryByEmail = async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: 'Email parameter is required' });
    }
    
    // Find user by email
    const user = await require('../models/User').findOne({ email });
    
    if (!user) {
      return res.status(400).json({ error: 'User not found with the provided email' });
    }
    
    // Parse query parameters
    const limit = parseInt(req.query.limit) || 100;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    
    // Get user history
    const userHistory = await BrowsingHistory.findOne({ user: user._id });
    
    if (!userHistory) {
      return res.status(200).json({ 
        history: [],
        total: 0,
        page,
        limit,
        pages: 0
      });
    }

    // Sort history by lastVisitTime (most recent first)
    const sortedHistory = userHistory.history
      .sort((a, b) => b.lastVisitTime - a.lastVisitTime);
    
    // Apply pagination
    const paginatedHistory = sortedHistory.slice(skip, skip + limit);
    const total = sortedHistory.length;
    const pages = Math.ceil(total / limit);

    return res.status(200).json({
      history: paginatedHistory,
      total,
      page,
      limit,
      pages,
      email: user.email
    });
  } catch (error) {
    console.error('Error getting browsing history by email:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get analytics for user browsing history
 */
exports.getHistoryAnalytics = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user._id;
    
    // Check if there's any history data
    const userHistory = await BrowsingHistory.findOne({ user: userId });
    
    if (!userHistory || userHistory.history.length === 0) {
      return res.status(404).json({ error: 'No browsing history data available for analysis' });
    }
    
    // Get cache parameter
    const useCache = req.query.cache !== 'false';
    
    // Check for cached analysis in the user history record
    if (useCache && userHistory.analysis && userHistory.analysisTimestamp) {
      // If analysis exists and is less than 1 hour old
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (userHistory.analysisTimestamp > oneHourAgo) {
        return res.status(200).json({
          analysis: userHistory.analysis,
          fromCache: true,
          analysisTimestamp: userHistory.analysisTimestamp
        });
      }
    }
    
    // If no cached analysis or force refresh, generate new analysis
    const analysis = await historyAnalysisService.analyzeUserHistory(userId);
    
    if (analysis.error) {
      return res.status(500).json({ error: analysis.error });
    }
    
    // Store the analysis in the user history record
    userHistory.analysis = analysis;
    userHistory.analysisTimestamp = new Date();
    await userHistory.save();
    
    return res.status(200).json({
      analysis,
      fromCache: false,
      analysisTimestamp: userHistory.analysisTimestamp
    });
  } catch (error) {
    console.error('Error getting history analytics:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get analytics for user by email (for testing without authentication)
 */
exports.getHistoryAnalyticsByEmail = async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: 'Email parameter is required' });
    }
    
    // Find user by email
    const user = await require('../models/User').findOne({ email });
    
    if (!user) {
      return res.status(400).json({ error: 'User not found with the provided email' });
    }
    
    const userId = user._id;
    
    // Check if there's any history data
    const userHistory = await BrowsingHistory.findOne({ user: userId });
    
    if (!userHistory || userHistory.history.length === 0) {
      return res.status(404).json({ error: 'No browsing history data available for analysis' });
    }
    
    // Get cache parameter
    const useCache = req.query.cache !== 'false';
    
    // Check for cached analysis in the user history record
    if (useCache && userHistory.analysis && userHistory.analysisTimestamp) {
      // If analysis exists and is less than 1 hour old
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (userHistory.analysisTimestamp > oneHourAgo) {
        return res.status(200).json({
          analysis: userHistory.analysis,
          fromCache: true,
          analysisTimestamp: userHistory.analysisTimestamp
        });
      }
    }
    
    // If no cached analysis or force refresh, generate new analysis
    const analysis = await historyAnalysisService.analyzeUserHistory(userId);
    
    if (analysis.error) {
      return res.status(500).json({ error: analysis.error });
    }
    
    // Store the analysis in the user history record
    userHistory.analysis = analysis;
    userHistory.analysisTimestamp = new Date();
    await userHistory.save();
    
    return res.status(200).json({
      analysis,
      fromCache: false,
      analysisTimestamp: userHistory.analysisTimestamp
    });
  } catch (error) {
    console.error('Error getting history analytics by email:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}; 