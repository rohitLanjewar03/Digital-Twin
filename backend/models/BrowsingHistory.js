const mongoose = require('mongoose');

const BrowsingHistoryItemSchema = new mongoose.Schema({
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
    required: true
  }
});

const BrowsingHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  history: [BrowsingHistoryItemSchema],
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  // Add analysis data fields
  analysis: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  analysisTimestamp: {
    type: Date,
    default: null
  }
});

// Index by user for faster queries
BrowsingHistorySchema.index({ user: 1 });

// Index by URLs and lastVisitTime for faster searches
BrowsingHistorySchema.index({ 'history.url': 1, 'history.lastVisitTime': -1 });

module.exports = mongoose.model('BrowsingHistory', BrowsingHistorySchema); 