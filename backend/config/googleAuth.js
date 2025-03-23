const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:5000/auth/google/callback",
    scope: [
        "profile",
        "email",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/calendar",
    ],
    passReqToCallback: true, // Add this to access `req` in the callback
}, async (req, accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
            user = new User({
                googleId: profile.id,
                name: profile.displayName,
                email: profile.emails[0].value,
                accessToken: accessToken, // Save access token
                refreshToken: refreshToken, // Save refresh token
                tokenExpiry: Date.now() + 3600 * 1000, // Set expiry time (1 hour)
            });
        } else {
            // Update tokens if user already exists
            user.accessToken = accessToken;
            user.refreshToken = refreshToken;
            user.tokenExpiry = Date.now() + 3600 * 1000;
        }

        await user.save();
        done(null, user);
    } catch (error) {
        done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});