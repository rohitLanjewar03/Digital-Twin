// Variables to store state
let historyData = [];
let isAuthenticated = false;

// DOM elements
const fetchBtn = document.getElementById('fetchBtn');
const sendBtn = document.getElementById('sendBtn');
const daysSelect = document.getElementById('days');
const statusDiv = document.getElementById('status');
const countDiv = document.getElementById('count');
const historyListDiv = document.getElementById('history-list');
const emailInput = document.getElementById('email');

// Check authentication status when popup opens
checkAuthStatus();

// Event listeners
fetchBtn.addEventListener('click', fetchHistory);
sendBtn.addEventListener('click', sendToServer);

// Function to check if user is authenticated with our service
function checkAuthStatus() {
  try {
    // First check if we have a session cookie
    chrome.cookies.get({
      url: 'http://localhost:5000',
      name: 'connect.sid'
    }, (cookie) => {
      if (cookie) {
        console.log('User is authenticated with cookie:', cookie);
        isAuthenticated = true;
        
        // Also check if we have cached history
        chrome.storage.local.get(['cachedHistory', 'userEmail'], (result) => {
          if (result.cachedHistory && result.cachedHistory.length > 0) {
            historyData = result.cachedHistory;
            displayHistory(historyData);
            sendBtn.disabled = false;
          }
          
          // Restore saved email if available
          if (result.userEmail) {
            emailInput.value = result.userEmail;
          }
        });
      } else {
        console.log('User is not authenticated (no cookie found)');
        showStatus('Please log in to your account on our website first', 'error');
      }
    });
  } catch (err) {
    console.error('Error in checkAuthStatus:', err);
    showStatus('Error checking authentication: ' + err.message, 'error');
  }
}

// Function to fetch history
function fetchHistory() {
  const days = parseInt(daysSelect.value);
  
  fetchBtn.disabled = true;
  showStatus(`Fetching history for the last ${days} days...`, 'normal');
  
  try {
    console.log(`Requesting ${days} days of history from background script`);
    
    // Calculate the date range for display
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    console.log(`Date range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
    
    chrome.runtime.sendMessage(
      { action: 'getHistory', days: days },
      (response) => {
        fetchBtn.disabled = false;
        
        if (chrome.runtime.lastError) {
          console.error('Runtime error:', chrome.runtime.lastError);
          showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
          return;
        }
        
        console.log('Received response:', response);
        
        if (response && response.success) {
          historyData = response.history;
          displayHistory(historyData);
          sendBtn.disabled = false; // Enable send button regardless of authentication
          
          // Get date range from actual data
          if (historyData.length > 0) {
            const timestamps = historyData.map(item => item.lastVisitTime);
            const oldestTime = Math.min(...timestamps);
            const newestTime = Math.max(...timestamps);
            
            const oldestDate = new Date(oldestTime);
            const newestDate = new Date(newestTime);
            
            const actualDays = (newestTime - oldestTime) / (1000 * 60 * 60 * 24);
            
            showStatus(
              `Successfully fetched ${historyData.length} history items from ${oldestDate.toLocaleDateString()} to ${newestDate.toLocaleDateString()} (${actualDays.toFixed(1)} days)`, 
              'success'
            );
          } else {
            showStatus(`No history found for the last ${days} days`, 'error');
          }
        } else {
          showStatus(`Error: ${response?.error || 'Unknown error'}`, 'error');
        }
      }
    );
  } catch (err) {
    console.error('Error in fetchHistory:', err);
    fetchBtn.disabled = false;
    showStatus('Error fetching history: ' + err.message, 'error');
  }
}

// Function to display history
function displayHistory(historyItems) {
  historyListDiv.innerHTML = '';
  countDiv.textContent = `Showing ${historyItems.length} history items`;
  countDiv.style.display = 'block';
  
  if (historyItems.length === 0) {
    historyListDiv.innerHTML = '<p>No history items found.</p>';
    return;
  }
  
  // Sort by most recent first
  historyItems.sort((a, b) => b.lastVisitTime - a.lastVisitTime);
  
  // Create a limited preview (max 100 items) to avoid performance issues
  const previewItems = historyItems.slice(0, 100);
  
  previewItems.forEach(item => {
    const itemEl = document.createElement('div');
    itemEl.className = 'history-item';
    
    const title = document.createElement('h3');
    title.textContent = item.title || 'No Title';
    
    const link = document.createElement('a');
    link.href = item.url;
    link.textContent = item.url;
    link.target = '_blank';
    
    // Format date
    const date = new Date(item.lastVisitTime);
    const timeEl = document.createElement('div');
    timeEl.className = 'time';
    timeEl.textContent = `Visited: ${date.toLocaleString()} (${item.visitCount} times)`;
    
    itemEl.appendChild(title);
    itemEl.appendChild(link);
    itemEl.appendChild(timeEl);
    
    historyListDiv.appendChild(itemEl);
  });
  
  if (historyItems.length > 100) {
    const more = document.createElement('p');
    more.textContent = `... and ${historyItems.length - 100} more items`;
    historyListDiv.appendChild(more);
  }
}

// Function to send history to server
function sendToServer() {
  if (!historyData || historyData.length === 0) {
    showStatus('No history data to send', 'error');
    return;
  }
  
  // Get user email
  const email = emailInput.value.trim();
  if (!email) {
    showStatus('Please enter your email address', 'error');
    return;
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showStatus('Please enter a valid email address', 'error');
    return;
  }
  
  // Save email for next time
  chrome.storage.local.set({ 'userEmail': email });
  
  // Calculate size of data (rough estimation)
  const dataSize = JSON.stringify(historyData).length / 1024;
  
  sendBtn.disabled = true;
  showStatus(`Sending ${historyData.length} history items (${dataSize.toFixed(2)} KB) to server...`, 'normal');
  
  try {
    console.log(`Sending ${historyData.length} history items to the server`);
    
    // For large data sets, warn the user that this might take a while
    if (historyData.length > 1000) {
      showStatus(`Sending ${historyData.length} history items (${dataSize.toFixed(2)} KB) to server. This may take a few moments...`, 'normal');
    }
    
    chrome.runtime.sendMessage(
      { 
        action: 'sendToServer', 
        data: historyData,
        email: email
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('Runtime error:', chrome.runtime.lastError);
          showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
          sendBtn.disabled = false;
          return;
        }
        
        console.log('Received response:', response);
        
        if (response && response.success) {
          if (response.response && response.response.message) {
            showStatus(response.response.message, 'success');
          } else {
            showStatus('Successfully sent data to server', 'success');
          }
          
          // If we have details about chunks, show additional information
          if (response.response && response.response.details && response.response.details.length > 0) {
            // Calculate total items saved across all chunks
            let totalItemsProcessed = 0;
            response.response.details.forEach(detail => {
              if (detail && detail.itemsReceived) {
                totalItemsProcessed += detail.itemsReceived;
              }
            });
            
            // Show count in the countDiv
            countDiv.textContent = `Sent ${totalItemsProcessed} history items to server and saved successfully.`;
            countDiv.style.display = 'block';
          }
        } else {
          // Display detailed error information
          let errorMsg = 'Unknown error occurred';
          
          if (response && response.error) {
            errorMsg = response.error;
          }
          
          console.error('Error response:', response);
          showStatus(`Error: ${errorMsg}`, 'error');
          
          // Show more debugging info in the console
          if (response && response.details) {
            console.error('Error details:', response.details);
          }
          
          sendBtn.disabled = false;
        }
      }
    );
  } catch (err) {
    console.error('Error in sendToServer:', err);
    sendBtn.disabled = false;
    showStatus('Error sending data: ' + err.message, 'error');
  }
}

// Function to show status messages
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.style.display = 'block';
  
  // Reset classes
  statusDiv.className = 'status';
  
  // Add type-specific class
  if (type === 'success') {
    statusDiv.classList.add('success');
  } else if (type === 'error') {
    statusDiv.classList.add('error');
  }
} 