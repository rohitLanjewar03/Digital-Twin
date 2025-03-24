const mongoose = require('mongoose');

const browsingHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  url: {
    type: String,
    required: true
  },
  title: {
    type: String
  },
  visitCount: {
    type: Number,
    default: 1
  },
  lastVisitTime: {
    type: Date,
    default: Date.now
  },
  syncTime: {
    type: Date,
    default: Date.now
  },
  // For categorization and analysis
  category: {
    type: String,
    default: 'other'
  },
  keywords: [{
    type: String
  }]
});

// Create compound index for faster lookups
browsingHistorySchema.index({ userId: 1, url: 1 });

module.exports = mongoose.model('BrowsingHistory', browsingHistorySchema); 