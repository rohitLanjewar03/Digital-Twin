const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    googleId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    accessToken: { type: String },
    refreshToken: String,
    tokenExpiry: Number
});

module.exports = mongoose.model('User', UserSchema);
