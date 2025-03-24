document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const userIdInput = document.getElementById('userId');
  const connectButton = document.getElementById('connect');
  const syncHistoryButton = document.getElementById('syncHistory');
  const timeRangeSelect = document.getElementById('timeRange');
  const connectionStatus = document.getElementById('connectionStatus');
  const statusDot = document.getElementById('statusDot');
  const lastSyncTime = document.getElementById('lastSyncTime');
  const autoConnectedMsg = document.createElement('div');
  autoConnectedMsg.className = 'auto-connected-message';
  autoConnectedMsg.innerHTML = 'Automatically connected with your account';
  
  // Load saved user ID and connection status
  chrome.storage.local.get(['userId', 'connected', 'lastSync', 'autoConnected'], (result) => {
    if (result.userId) {
      userIdInput.value = result.userId;
      
      // If auto-connected, show message
      if (result.autoConnected) {
        const connectionContainer = document.querySelector('.connection-container');
        connectionContainer.appendChild(autoConnectedMsg);
      }
    }
    
    if (result.connected) {
      updateConnectionStatus(true);
    }
    
    if (result.lastSync) {
      lastSyncTime.textContent = `Last synced: ${new Date(result.lastSync).toLocaleString()}`;
    }
  });
  
  // Connect button click handler
  connectButton.addEventListener('click', async () => {
    const userId = userIdInput.value.trim();
    
    if (!userId) {
      alert('Please enter your User ID');
      return;
    }
    
    try {
      // Validate user ID exists in the backend
      const response = await fetch(`http://localhost:5000/history/validate/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Invalid User ID');
      }
      
      // Save user ID and update connection status
      chrome.storage.local.set({ 
        userId: userId,
        connected: true,
        autoConnected: false
      });
      
      updateConnectionStatus(true);
      
      // Remove auto-connected message if it exists
      if (autoConnectedMsg.parentNode) {
        autoConnectedMsg.parentNode.removeChild(autoConnectedMsg);
      }
      
    } catch (error) {
      alert(`Connection failed: ${error.message}`);
      console.error('Connection error:', error);
    }
  });
  
  // Sync history button click handler
  syncHistoryButton.addEventListener('click', async () => {
    const timeRange = timeRangeSelect.value;
    const userId = userIdInput.value.trim();
    
    if (!userId) {
      alert('Please connect to your Email Assistant account first');
      return;
    }
    
    syncHistoryButton.disabled = true;
    syncHistoryButton.textContent = 'Syncing...';
    
    try {
      // Get browsing history based on time range
      const historyItems = await getBrowsingHistory(timeRange);
      
      console.log(`Retrieved ${historyItems.length} history items from Chrome`);
      
      // Process history to remove sensitive sites and format properly
      const processedHistory = processHistoryItems(historyItems);
      
      console.log(`Processed ${processedHistory.length} history items after filtering`);
      
      if (processedHistory.length === 0) {
        alert('No browsing history items to sync. Try selecting a longer time range.');
        return;
      }
      
      // Log the first item to help with debugging
      console.log('Sample history item being sent:', processedHistory[0]);
      
      // Send to backend
      const response = await fetch('http://localhost:5000/history/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: userId,
          historyItems: processedHistory
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to sync history: ${errorData.message || response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log('Sync response:', responseData);
      
      const now = new Date();
      chrome.storage.local.set({ lastSync: now.getTime() });
      lastSyncTime.textContent = `Last synced: ${now.toLocaleString()}`;
      
      alert(`History successfully synced: Added ${responseData.results.added}, Updated ${responseData.results.updated}`);
      
    } catch (error) {
      alert(`Sync failed: ${error.message}`);
      console.error('Sync error:', error);
    } finally {
      syncHistoryButton.disabled = false;
      syncHistoryButton.textContent = 'Sync Browsing History';
    }
  });

  // Disconnect button
  const disconnectButton = document.createElement('button');
  disconnectButton.textContent = 'Disconnect';
  disconnectButton.className = 'disconnect-button';
  disconnectButton.addEventListener('click', () => {
    chrome.storage.local.set({
      connected: false,
      autoConnected: false
    }, () => {
      updateConnectionStatus(false);
      // Remove auto-connected message if it exists
      if (autoConnectedMsg.parentNode) {
        autoConnectedMsg.parentNode.removeChild(autoConnectedMsg);
      }
    });
  });
  
  // Add disconnect button
  const connectionContainer = document.querySelector('.connection-container');
  connectionContainer.appendChild(disconnectButton);
  
  // Helper functions
  function updateConnectionStatus(isConnected) {
    if (isConnected) {
      connectionStatus.textContent = 'Connected';
      statusDot.classList.remove('disconnected');
      statusDot.classList.add('connected');
      syncHistoryButton.disabled = false;
      disconnectButton.style.display = 'block';
    } else {
      connectionStatus.textContent = 'Disconnected';
      statusDot.classList.remove('connected');
      statusDot.classList.add('disconnected');
      syncHistoryButton.disabled = true;
      disconnectButton.style.display = 'none';
    }
  }
  
  async function getBrowsingHistory(timeRange) {
    const millisecondsPerHour = 60 * 60 * 1000;
    const millisecondsPerDay = 24 * millisecondsPerHour;
    
    let startTime;
    const now = new Date().getTime();
    
    switch (timeRange) {
      case 'hour':
        startTime = now - millisecondsPerHour;
        break;
      case 'day':
        startTime = now - millisecondsPerDay;
        break;
      case 'week':
        startTime = now - (7 * millisecondsPerDay);
        break;
      case 'month':
        startTime = now - (30 * millisecondsPerDay);
        break;
      default:
        startTime = now - millisecondsPerDay; // Default to 1 day
    }
    
    return new Promise((resolve) => {
      chrome.history.search({
        text: '',           // Return all history items
        startTime: startTime,
        maxResults: 5000    // Limit results
      }, (historyItems) => {
        resolve(historyItems);
      });
    });
  }
  
  function processHistoryItems(historyItems) {
    // Filter out sensitive sites (banking, health, adult content, etc.)
    const sensitivePatterns = [
      /bank/i, /health/i, /medical/i, /adult/i, /porn/i, 
      /sex/i, /credit/i, /loan/i, /insurance/i, /tax/i,
      /finance/i, /password/i, /secure/i, /login/i
    ];
    
    // For testing - create some dummy items if no history available
    if (historyItems.length === 0) {
      console.log('No history items found. Adding test data.');
      return [
        {
          url: 'https://www.google.com/search?q=javascript+programming',
          title: 'JavaScript Programming - Google Search',
          visitCount: 3,
          lastVisitTime: new Date().getTime()
        },
        {
          url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
          title: 'JavaScript - MDN Web Docs',
          visitCount: 2,
          lastVisitTime: new Date().getTime() - 1000000
        },
        {
          url: 'https://www.nytimes.com/section/technology',
          title: 'Technology News - The New York Times',
          visitCount: 1,
          lastVisitTime: new Date().getTime() - 2000000
        }
      ];
    }
    
    return historyItems
      .filter(item => {
        // Skip items without URLs or titles
        if (!item.url || !item.title) return false;
        
        // Skip sensitive sites
        const url = item.url.toLowerCase();
        const title = item.title.toLowerCase();
        
        for (const pattern of sensitivePatterns) {
          if (pattern.test(url) || pattern.test(title)) {
            return false;
          }
        }
        
        return true;
      })
      .map(item => ({
        url: item.url,
        title: item.title,
        visitCount: item.visitCount || 1,
        lastVisitTime: item.lastVisitTime
      }));
  }
}); 