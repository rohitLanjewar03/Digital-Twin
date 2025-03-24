# Email Assistant History Connector

A browser extension that connects your browsing history to your Email Assistant application to provide context-aware email suggestions.

## Features

- **Secure Authentication**: Connect your browser extension to your Email Assistant account
- **Privacy-Focused**: History data is only sent when you explicitly click "Sync"
- **Intelligent Filtering**: Sensitive sites (banking, health, adult content) are automatically filtered out
- **Time Range Selection**: Choose how much browsing history to share (hour, day, week, month)
- **Full User Control**: Clear synced data at any time

## Installation

### Developer Mode

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the extension directory
5. The extension icon should appear in your browser toolbar

### From Chrome Web Store (Coming Soon)

1. Visit the Chrome Web Store
2. Search for "Email Assistant History Connector"
3. Click "Add to Chrome"

## Usage

1. Click the extension icon in your browser toolbar
2. Enter your Email Assistant User ID (found in your Email Assistant profile)
3. Click "Connect to Email Assistant"
4. Select a time range for history data
5. Click "Sync Browsing History"

## Privacy

This extension is designed with privacy as a priority:

- **Explicit Control**: Data is only sent when you click the "Sync" button
- **Data Filtering**: Sensitive sites are automatically filtered out
- **Limited Data**: Only URLs, titles, and visit counts are shared (no form data or cookies)
- **Local Processing**: Initial filtering happens locally before sending data
- **Secure Communication**: All data is transmitted securely to your Email Assistant account

## Development

This extension is built using standard web technologies:

- HTML/CSS for the popup interface
- JavaScript for functionality
- Chrome Extension APIs for browser integration

To contribute:

1. Fork the repository
2. Make your changes
3. Submit a pull request

## License

MIT

## Support

For issues or questions, please contact support@emailassistant.com 