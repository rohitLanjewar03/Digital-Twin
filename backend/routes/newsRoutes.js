const express = require('express');
const { searchNews, getRecommendedNews } = require('../controllers/newsController');
const { isAuthenticated } = require('../middleware/authMiddleware');

const router = express.Router();

// Route to search for news articles
// POST /news/search
router.post('/search', isAuthenticated, searchNews);

// Route to get personalized news recommendations
// GET /news/recommended
router.get('/recommended', isAuthenticated, getRecommendedNews);

module.exports = router; 