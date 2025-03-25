// Background script for history collection
console.log('Background script started with version 1.0.1');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message.action);
  
  if (message.action === 'getHistory') {
    const days = message.days || 7;
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const startTime = new Date().getTime() - (days * millisecondsPerDay);
    
    chrome.history.search({
      text: '',          // Return all history items
      startTime: startTime,
      maxResults: 5000   // Reasonable limit
    }, (historyItems) => {
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
    
    console.log('Starting fetch to send data to server:', apiEndpoint);
    
    fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        history: historyData,
        timestamp: new Date().toISOString(),
        email: userEmail // Include the email
      }),
      credentials: 'include' // Include credentials for session cookie
    })
    .then(response => {
      console.log('Server response status:', response.status);
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('Server response data:', data);
      sendResponse({ 
        success: true, 
        response: data 
      });
    })
    .catch(error => {
      console.error('Error sending data to server:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    });
    
    // Return true to indicate we'll respond asynchronously
    return true;
  }
}); 