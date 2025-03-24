// Background script for Email Assistant History Connector

// Listen for installation or update
chrome.runtime.onInstalled.addListener(() => {
  console.log('Email Assistant History Connector installed or updated');
  openOnboarding();
});

// Function to open onboarding page
function openOnboarding() {
  const onboardingUrl = chrome.runtime.getURL('onboarding.html');
  chrome.tabs.create({ url: onboardingUrl });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openOnboarding') {
    openOnboarding();
    sendResponse({ success: true });
  }
});

// Keep track of connected tabs to prevent duplicate auto-connection
const connectedTabs = new Set();

// Auto-connect to the application if it's open
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only check completed loads of our app URLs
  if (
    changeInfo.status === 'complete' && 
    tab.url && 
    (tab.url.startsWith('http://localhost:5173') || tab.url.startsWith('http://localhost:3000')) &&
    !connectedTabs.has(tabId)
  ) {
    // Add to connected tabs set
    connectedTabs.add(tabId);
    
    // Check if already connected before attempting again
    chrome.storage.local.get(['connected', 'autoConnected'], (result) => {
      // Only auto-connect if not already connected
      if (!result.connected || !result.autoConnected) {
        // Inject script to extract user ID from page
        chrome.scripting.executeScript({
          target: { tabId },
          function: extractUserIdFromPage
        })
        .then(results => {
          const userId = results?.[0]?.result;
          if (userId) {
            // Save user ID and set as connected
            chrome.storage.local.set({
              userId: userId,
              connected: true,
              autoConnected: true,
              lastConnected: Date.now() // Track when we last connected
            }, () => {
              console.log('Auto-connected with user ID:', userId);
              
              // Show a notification (only once per session)
              chrome.notifications.create({
                type: 'basic',
                iconUrl: 'images/icon128.png',
                title: 'Email Assistant Connected',
                message: 'Your browsing history extension is now connected to your Email Assistant account.',
                buttons: [
                  { title: 'View Settings' }
                ]
              });
            });
          }
        })
        .catch(error => {
          console.error('Error auto-connecting:', error);
        });
      }
    });
  }
});

// Clean up connected tabs when they're closed
chrome.tabs.onRemoved.addListener((tabId) => {
  connectedTabs.delete(tabId);
});

// Notification click handler
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    // Open extension popup
    chrome.action.openPopup();
  }
});

// Function to extract user ID from page
function extractUserIdFromPage() {
  try {
    // Try to get from localStorage first (most common)
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      if (user && user._id) {
        return user._id;
      }
    }
    
    // Try other common localStorage keys
    const possibleKeys = ['userData', 'currentUser', 'auth', 'userInfo'];
    for (const key of possibleKeys) {
      const data = localStorage.getItem(key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (parsed && (parsed._id || parsed.id || parsed.userId)) {
            return parsed._id || parsed.id || parsed.userId;
          }
        } catch (e) {
          console.warn('Failed to parse localStorage item:', key);
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting user ID:', error);
    return null;
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'validateConnection') {
    // Check if backend is online
    fetch('http://localhost:5000/health')
      .then(response => {
        sendResponse({ success: response.ok });
      })
      .catch(error => {
        console.error('Connection validation error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
}); 