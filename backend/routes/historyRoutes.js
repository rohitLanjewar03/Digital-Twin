const express = require('express');
const historyController = require('../controllers/historyController');
const { isAuthenticated } = require('../middleware/authMiddleware');
const BrowsingHistory = require('../models/BrowsingHistory');
const User = require('../models/User');

const router = express.Router();

// Add public endpoint for getting history by email
router.get('/by-email', historyController.getHistoryByEmail);

// Protect most routes with authentication middleware
router.use(isAuthenticated);

// Route to save browsing history from the extension
router.post('/', historyController.saveHistory);

// Route to get user's browsing history
router.get('/', historyController.getHistory);

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
    console.log('Received test history data:', req.body);
    
    const { history, email } = req.body;
    
    if (!history || !Array.isArray(history)) {
      return res.status(400).json({ error: 'Invalid history data format' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Email is required to identify the user' });
    }

    // Get user by email - this is a simplified version for testing
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'User not found with the provided email' });
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
        user: user._id,
        history: processedHistory,
        lastUpdated: new Date()
      });
      
      await userHistory.save();
    }

    return res.status(200).json({ 
      success: true, 
      message: 'History saved successfully',
      count: userHistory.history.length,
      user: user.email
    });
  } catch (error) {
    console.error('Error in test endpoint:', error);
    return res.status(500).json({ error: 'Server error in test endpoint' });
  }
});

module.exports = router; 