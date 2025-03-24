const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { isAuthenticated } = require('../middleware/authMiddleware');

// Record a new search
router.post('/record', isAuthenticated, searchController.recordSearch);

// Get user's search history
router.get('/history', isAuthenticated, searchController.getSearchHistory);

// Get search analytics
router.get('/analytics', isAuthenticated, searchController.getSearchAnalytics);

// Clear search history
router.delete('/clear', isAuthenticated, searchController.clearSearchHistory);

module.exports = router; 