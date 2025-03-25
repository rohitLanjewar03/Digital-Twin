/**
 * Script to clean up invalid interest data in user records
 * 
 * Usage:
 * node cleanup-interests.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function cleanupInterests() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Find all users
    const users = await User.find({});
    console.log(`Found ${users.length} users`);
    
    let updatedCount = 0;
    
    // Process each user
    for (const user of users) {
      let needsUpdate = false;
      let cleanInterests = [];
      
      // Check if interests exist and is an array
      if (user.interests && Array.isArray(user.interests)) {
        // Process each interest
        cleanInterests = user.interests
          .filter(interest => interest !== null && interest !== undefined)
          .map(interest => {
            // If already a string, keep it
            if (typeof interest === 'string') {
              return interest;
            }
            
            // Try to convert objects to strings
            if (typeof interest === 'object') {
              try {
                return JSON.stringify(interest);
              } catch (err) {
                console.error(`Error converting interest to string for user ${user._id}:`, err);
                return null;
              }
            }
            
            // Convert any other types to string
            return String(interest);
          })
          .filter(interest => interest !== null);
        
        // Check if we need to update
        needsUpdate = JSON.stringify(cleanInterests) !== JSON.stringify(user.interests);
      } else if (user.interests !== undefined) {
        // Interests exists but is not an array
        needsUpdate = true;
        cleanInterests = [];
      }
      
      // Update user if needed
      if (needsUpdate) {
        await User.updateOne({ _id: user._id }, { $set: { interests: cleanInterests } });
        console.log(`Updated interests for user ${user._id}`);
        updatedCount++;
      }
    }
    
    console.log(`Updated ${updatedCount} users`);
    console.log('Interest cleanup completed successfully');
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run the cleanup function
cleanupInterests(); 