const express = require('express');
const { searchNews } = require('../controllers/newsController');
const { isAuthenticated } = require('../middleware/authMiddleware');

const router = express.Router();

// Route to search for news articles
// POST /news/search
router.post('/search', isAuthenticated, searchNews);

module.exports = router; 