# Browsing History Collector Extension

This browser extension collects your browsing history and sends it to our Digital Twin web application.

## Installation

Since this extension is not published on the Chrome Web Store, you need to install it in developer mode:

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" by toggling the switch in the top right corner
3. Click "Load unpacked" and select the `browser-extension` folder from this project
4. The extension should now appear in your extensions list

## How to Use

1. First, make sure you're logged in to the Digital Twin web application at http://localhost:5173
2. Click on the extension icon in your browser toolbar to open the popup
3. Choose how many days of history you want to fetch (default: 7 days)
4. Click "Fetch History" to retrieve your browsing history
5. Review the history that will be sent to the server
6. Click "Send to Server" to upload your browsing history

## Privacy Notes

- Your browsing history is only sent to the server when you explicitly click "Send to Server"
- You must be logged in to your Digital Twin account for the data to be properly associated with your profile
- The extension only accesses the history data you choose to fetch (by default, the past 7 days)
- You can delete your browsing history from the server at any time using the "Delete All History" button on the Browsing History page

## Features

- Fetch browsing history for the last 1, 7, 14, or 30 days
- Preview history items before sending to the server
- Secure storage of browsing data in your Digital Twin profile
- View and manage your uploaded browsing history through the web interface

## Troubleshooting

- If you see an authentication error, make sure you're logged in to the Digital Twin web application
- If the extension can't connect to the server, verify that the backend is running at http://localhost:5000
- For other issues, check the browser's developer console for error messages 