const express = require('express');
const { googleAuth, googleAuthCallback, handleGoogleCallback, logout, getUserProfile, refreshSession, validateSession } = require('../controllers/authController');
const { isAuthenticated } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes
router.get('/google', googleAuth);
router.get('/google/callback', googleAuthCallback, handleGoogleCallback);

// Session validation route
router.get('/validate-session', validateSession);

// Protected routes
router.get('/me', isAuthenticated, getUserProfile);
router.get('/refresh', isAuthenticated, refreshSession);
router.get('/logout', isAuthenticated, logout);

module.exports = router;