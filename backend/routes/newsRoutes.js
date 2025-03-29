const express = require('express');
const { searchNews, getRecommendedNews, summarizeArticle } = require('../controllers/newsController');
const { isAuthenticated } = require('../middleware/authMiddleware');

const router = express.Router();

// Route to search for news articles
// POST /news/search
router.post('/search', isAuthenticated, searchNews);

// Route to get personalized news recommendations
// GET /news/recommended
router.get('/recommended', isAuthenticated, getRecommendedNews);

// Route to get AI summary of a news article
// POST /news/summarize
router.post('/summarize', isAuthenticated, summarizeArticle);

module.exports = router;