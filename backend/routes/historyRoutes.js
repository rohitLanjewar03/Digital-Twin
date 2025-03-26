const express = require('express');
const historyController = require('../controllers/historyController');
const { isAuthenticated } = require('../middleware/authMiddleware');
const BrowsingHistory = require('../models/BrowsingHistory');
const User = require('../models/User');

const router = express.Router();

// Add public endpoint for getting history by email
router.get('/by-email', historyController.getHistoryByEmail);

// Add public endpoint for analytics by email (no auth required)
router.get('/analytics-by-email', historyController.getHistoryAnalyticsByEmail);

// Protect most routes with authentication middleware
router.use(isAuthenticated);

// Route to save browsing history from the extension
router.post('/', historyController.saveHistory);

// Route to get user's browsing history
router.get('/', historyController.getHistory);

// Route to get analytics for user's browsing history
router.get('/analytics', historyController.getHistoryAnalytics);

// Route to delete browsing history
router.delete('/', historyController.deleteHistory);

// Remove the isAuthenticated middleware from this route
router.use('/test', (req, res, next) => {
  next();
});

// Test endpoint for the extension that actually saves the data
// This uses a simple email parameter to identify the user
router.post('/test', async (req, res) => {
  try {
    const { history, email, chunkInfo } = req.body;
    
    // Log chunk information if available
    if (chunkInfo) {
      console.log(`Received chunk ${chunkInfo.chunkNumber}/${chunkInfo.totalChunks} with ${history ? history.length : 0} items for email: ${email}`);
    } else {
      console.log(`Received test history data with ${history ? history.length : 0} items for email: ${email}`);
    }
    
    if (!history || !Array.isArray(history)) {
      return res.status(400).json({ error: 'Invalid history data format' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Email is required to identify the user' });
    }

    // Get user by email - this is a simplified version for testing
    let user = await User.findOne({ email });
    
    // If user doesn't exist, create a temporary one with the provided email
    if (!user) {
      console.log(`User not found with email ${email}, creating temporary user`);
      user = new User({
        googleId: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`, // Generate a temporary unique ID
        name: email.split('@')[0], // Use part of email as name
        email: email,
        // No tokens needed for history collection
      });
      
      try {
        await user.save();
        console.log(`Created temporary user with email: ${email}`);
      } catch (userError) {
        console.error('Error creating temporary user:', userError);
        return res.status(500).json({ error: 'Failed to create temporary user' });
      }
    }

    // Analyze the date range of the history data
    if (history.length > 0) {
      const timestamps = history.map(item => new Date(item.lastVisitTime).getTime());
      const oldestTime = Math.min(...timestamps);
      const newestTime = Math.max(...timestamps);
      const oldestDate = new Date(oldestTime);
      const newestDate = new Date(newestTime);
      const daysCovered = (newestTime - oldestTime) / (1000 * 60 * 60 * 24);
      
      console.log(`Current chunk history date range: ${oldestDate.toLocaleString()} to ${newestDate.toLocaleString()}`);
      console.log(`Days covered in this chunk: ${daysCovered.toFixed(1)}`);
      
      // Count items per day
      const dayBuckets = {};
      history.forEach(item => {
        const date = new Date(item.lastVisitTime);
        const dateStr = date.toDateString();
        if (!dayBuckets[dateStr]) {
          dayBuckets[dateStr] = 0;
        }
        dayBuckets[dateStr]++;
      });
      
      console.log('Items per day in this chunk:', dayBuckets);
    }

    // Process the history items to ensure proper format
    const processedHistory = history.map(item => ({
      url: item.url,
      title: item.title || 'No Title',
      visitCount: item.visitCount || 1,
      lastVisitTime: new Date(item.lastVisitTime)
    }));

    // Find existing history for this user or create a new one
    let userHistory = await BrowsingHistory.findOne({ user: user._id });

    if (userHistory) {
      // Update existing history
      // For each new history item:
      // - If URL exists, update visit count and time
      // - If URL is new, add to history array
      let updatedCount = 0;
      let newCount = 0;
      
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
          updatedCount++;
        } else {
          // Add new item
          userHistory.history.push(newItem);
          newCount++;
        }
      });
      
      userHistory.lastUpdated = new Date();
      await userHistory.save();
      
      console.log(`Updated ${updatedCount} existing items and added ${newCount} new items`);
    } else {
      // Create new history record
      userHistory = new BrowsingHistory({
        user: user._id,
        history: processedHistory,
        lastUpdated: new Date()
      });
      
      await userHistory.save();
      console.log(`Created new history record with ${processedHistory.length} items`);
    }

    // Prepare response
    const response = { 
      success: true, 
      message: chunkInfo 
        ? `Chunk ${chunkInfo.chunkNumber}/${chunkInfo.totalChunks} processed successfully` 
        : 'History saved successfully',
      count: userHistory.history.length,
      user: user.email,
      itemsReceived: history.length,
      totalStoredItems: userHistory.history.length
    };
    
    // Add chunk info to response if available
    if (chunkInfo) {
      response.chunkInfo = chunkInfo;
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error in test endpoint:', error);
    return res.status(500).json({ error: 'Server error in test endpoint' });
  }
});

module.exports = router; 