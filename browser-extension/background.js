// Background script for history collection
console.log('Background script started with version 1.0.4');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message.action);
  
  if (message.action === 'getHistory') {
    const days = message.days || 7;
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const startTime = new Date().getTime() - (days * millisecondsPerDay);
    
    console.log(`Fetching history for ${days} days, starting from ${new Date(startTime).toISOString()}`);
    
    // Use a more robust search to ensure we get history from all days
    fetchHistoryForRange(startTime, new Date().getTime(), 5000, (historyItems) => {
      if (chrome.runtime.lastError) {
        console.error('Error fetching history:', chrome.runtime.lastError);
        sendResponse({ 
          success: false, 
          error: chrome.runtime.lastError.message 
        });
        return;
      }
      
      // Process history items to remove sensitive information if needed
      const processedItems = historyItems.map(item => ({
        id: item.id,
        url: item.url,
        title: item.title,
        visitCount: item.visitCount,
        lastVisitTime: item.lastVisitTime
      }));
      
      // Store in local storage as well
      chrome.storage.local.set({ 'cachedHistory': processedItems }, () => {
        console.log('History saved to local storage');
      });
      
      console.log(`Successfully fetched ${processedItems.length} history items`);
      
      // Group items by day for logging purposes
      const dayBuckets = {};
      processedItems.forEach(item => {
        const date = new Date(item.lastVisitTime);
        const dateStr = date.toDateString();
        if (!dayBuckets[dateStr]) {
          dayBuckets[dateStr] = 0;
        }
        dayBuckets[dateStr]++;
      });
      
      console.log('Items per day:', dayBuckets);
      
      sendResponse({ 
        success: true, 
        history: processedItems 
      });
    });
    
    // Return true to indicate we'll respond asynchronously
    return true;
  }
  
  if (message.action === 'sendToServer') {
    const historyData = message.data;
    const userEmail = message.email || ''; // Get email if provided
    
    // Use the test endpoint that doesn't require authentication
    const apiEndpoint = 'http://localhost:5000/history/test';
    
    console.log(`Preparing to send ${historyData.length} history items for email: ${userEmail}`);
    
    // Implement chunking to handle large amounts of data
    // Reduce chunk size from 500 to 100 items to avoid 413 Payload Too Large errors
    const CHUNK_SIZE = 100;
    const chunks = [];
    
    for (let i = 0; i < historyData.length; i += CHUNK_SIZE) {
      chunks.push(historyData.slice(i, i + CHUNK_SIZE));
    }
    
    console.log(`Split history data into ${chunks.length} chunks of max ${CHUNK_SIZE} items each`);
    
    // Send chunks sequentially
    sendChunksSequentially(chunks, 0, apiEndpoint, userEmail)
      .then(results => {
        console.log('All chunks sent successfully:', results);
        sendResponse({ 
          success: true, 
          response: {
            message: `Successfully sent ${historyData.length} history items in ${chunks.length} chunks`,
            details: results
          }
        });
      })
      .catch(error => {
        console.error('Error sending chunks:', error);
        sendResponse({ 
          success: false, 
          error: error.message 
        });
      });
    
    // Return true to indicate we'll respond asynchronously
    return true;
  }
});

// Function to send chunks of history data sequentially
async function sendChunksSequentially(chunks, startIndex, apiEndpoint, userEmail, retryCount = 0) {
  const MAX_RETRIES = 3;
  
  if (startIndex >= chunks.length) {
    return []; // All chunks sent
  }
  
  const currentChunk = chunks[startIndex];
  console.log(`Sending chunk ${startIndex + 1}/${chunks.length} with ${currentChunk.length} items`);
  
  try {
    // Calculate chunk size for logging
    const chunkDataSize = JSON.stringify({
      history: currentChunk,
      email: userEmail,
      chunkInfo: { chunkNumber: startIndex + 1, totalChunks: chunks.length }
    }).length / 1024;
    
    console.log(`Chunk ${startIndex + 1} size: ${chunkDataSize.toFixed(2)} KB`);
    
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        history: currentChunk,
        timestamp: new Date().toISOString(),
        email: userEmail,
        chunkInfo: {
          chunkNumber: startIndex + 1,
          totalChunks: chunks.length
        }
      }),
      credentials: 'include' // Include credentials for session cookie
    });
    
    console.log(`Chunk ${startIndex + 1} response status:`, response.status);
    
    if (!response.ok) {
      // Get the error message if possible
      let errorMessage = `Server responded with ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        // Ignore JSON parsing errors
      }
      
      // If we have retries left, try again
      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying chunk ${startIndex + 1} (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        // Add a longer delay for retries
        await new Promise(resolve => setTimeout(resolve, 1000));
        return sendChunksSequentially(chunks, startIndex, apiEndpoint, userEmail, retryCount + 1);
      }
      
      throw new Error(`Network response was not ok for chunk ${startIndex + 1}: ${errorMessage}`);
    }
    
    const data = await response.json();
    console.log(`Chunk ${startIndex + 1} response data:`, data);
    
    // Add a small delay between chunks to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Process next chunk
    const remainingResults = await sendChunksSequentially(chunks, startIndex + 1, apiEndpoint, userEmail);
    return [data, ...remainingResults];
  } catch (error) {
    console.error(`Error sending chunk ${startIndex + 1}:`, error);
    
    // If we have retries left, try again after a delay
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying chunk ${startIndex + 1} after error (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      // Exponential backoff for retries
      const delay = 1000 * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      return sendChunksSequentially(chunks, startIndex, apiEndpoint, userEmail, retryCount + 1);
    }
    
    throw error;
  }
}

// Function to fetch history for a specific time range
// Modify the fetchHistoryForRange function in background.js
function fetchHistoryForRange(startTime, endTime, maxResults, callback) {
  // Split the time range into smaller chunks (e.g., 3-day chunks)
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const chunkSize = 3 * millisecondsPerDay; // 3 days per chunk
  const chunks = [];
  
  // Create time chunks
  for (let start = startTime; start < endTime; start += chunkSize) {
    const end = Math.min(start + chunkSize, endTime);
    chunks.push({ start, end });
  }
  
  console.log(`Split time range into ${chunks.length} chunks`);
  
  // Process all chunks and combine results
  let allItems = [];
  let processedChunks = 0;
  
  chunks.forEach((chunk, index) => {
    chrome.history.search({
      text: '',
      startTime: chunk.start,
      endTime: chunk.end,
      maxResults: 5000 // Max per chunk
    }, (historyItems) => {
      console.log(`Chunk ${index+1}/${chunks.length} returned ${historyItems.length} items`);
      allItems = [...allItems, ...historyItems];
      processedChunks++;
      
      // When all chunks processed, return combined results
      if (processedChunks === chunks.length) {
        // Remove duplicates by URL
        const uniqueItems = [];
        const seenUrls = new Set();
        
        allItems.forEach(item => {
          if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            uniqueItems.push(item);
          }
        });
        
        console.log(`Total items after deduplication: ${uniqueItems.length}`);
        callback(uniqueItems);
      }
    });
  });
}