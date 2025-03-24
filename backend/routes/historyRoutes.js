const express = require('express');
const router = express.Router();
const historyController = require('../controllers/historyController');
const { isAuthenticated } = require('../middleware/authMiddleware');

// Public routes for extension
router.post('/sync', historyController.syncHistory);
router.get('/validate/:userId', historyController.validateUser);
router.get('/health', historyController.healthCheck);

// Protected routes (require authentication)
router.get('/user/:userId', isAuthenticated, historyController.getUserHistory);
router.get('/analytics/:userId', isAuthenticated, historyController.getHistoryAnalytics);
router.delete('/clear/:userId', isAuthenticated, historyController.clearHistory);

module.exports = router; 