const mongoose = require('mongoose');

const searchHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  query: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  // Metadata for analysis
  category: {
    type: String
  },
  topicTags: [{
    type: String
  }]
});

// Add index for faster queries by userId
searchHistorySchema.index({ userId: 1 });

module.exports = mongoose.model('SearchHistory', searchHistorySchema); 