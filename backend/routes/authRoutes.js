const express = require('express');
const { googleAuth, googleAuthCallback, handleGoogleCallback, logout, getUserProfile } = require('../controllers/authController');

const router = express.Router();

// Google OAuth2 Routes
router.get('/google', googleAuth);
router.get('/google/callback', googleAuthCallback, handleGoogleCallback);
// Get User Profile Route
router.get('/me', getUserProfile);

// Logout Route
router.get('/logout', logout);



module.exports = router;