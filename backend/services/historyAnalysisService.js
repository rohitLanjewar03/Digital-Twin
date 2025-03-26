const { OpenAI } = require('openai');
const BrowsingHistory = require('../models/BrowsingHistory');
const axios = require('axios');
const urlParser = require('url');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Helper function to safely parse JSON from OpenAI responses
 * @param {string} text - Text from OpenAI that might contain JSON
 * @returns {Object} Parsed JSON object
 */
const safeJSONParse = (text) => {
  try {
    // First attempt direct parsing
    return JSON.parse(text);
  } catch (error) {
    try {
      // Check if response is wrapped in markdown code blocks
      if (text.includes('```json') || text.includes('```')) {
        // Extract content between code blocks
        let jsonContent = text.replace(/^```json\s+/, '').replace(/^```\s+/, '').replace(/\s+```$/, '');
        return JSON.parse(jsonContent);
      }
      
      // Try to find JSON-like content in the text
      const jsonMatch = text.match(/(\{[\s\S]*\})/);
      if (jsonMatch && jsonMatch[0]) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Could not parse JSON from response');
    } catch (innerError) {
      console.error('JSON parsing error:', innerError);
      throw new Error(`Failed to parse JSON: ${innerError.message}`);
    }
  }
};

/**
 * Main function to analyze user browsing history
 * @param {string} userId - User ID to analyze
 * @returns {Object} Analysis results
 */
const analyzeUserHistory = async (userId) => {
  try {
    // Get all browsing history for the user
    const userHistory = await BrowsingHistory.findOne({ user: userId });
    
    if (!userHistory || userHistory.history.length === 0) {
      return { error: 'No browsing history data available for analysis' };
    }
    
    // Collect raw data for analysis
    const historyItems = userHistory.history;
    
    // Run various analysis functions
    const results = await Promise.all([
      analyzeVisitTimeDistribution(historyItems),
      analyzeDomainFrequency(historyItems),
      analyzeTopicCategories(historyItems),
      analyzeContentTypes(historyItems),
      analyzeUserBehaviorPatterns(historyItems),
      analyzeUserBehaviorDetails(historyItems)
    ]);
    
    // Combine all results
    return {
      timestamp: new Date(),
      totalItems: historyItems.length,
      timeDistribution: results[0],
      domainFrequency: results[1],
      topicCategories: results[2],
      contentTypes: results[3],
      behaviorPatterns: results[4],
      behaviorDetails: results[5]
    };
  } catch (error) {
    console.error('Error analyzing user history:', error);
    return { error: error.message };
  }
};

/**
 * Analyze when the user is most active online
 * @param {Array} historyItems - Array of browsing history items
 * @returns {Object} Time distribution analysis
 */
const analyzeVisitTimeDistribution = async (historyItems) => {
  // Group visits by hour of day
  const hourDistribution = Array(24).fill(0);
  // Group visits by day of week (0 = Sunday, 6 = Saturday)
  const dayDistribution = Array(7).fill(0);
  // Group by date to create timeline
  const dateVisits = {};
  
  historyItems.forEach(item => {
    const visitDate = new Date(item.lastVisitTime);
    const hour = visitDate.getHours();
    const day = visitDate.getDay();
    const dateKey = visitDate.toISOString().split('T')[0];
    
    hourDistribution[hour]++;
    dayDistribution[day]++;
    
    if (!dateVisits[dateKey]) {
      dateVisits[dateKey] = 0;
    }
    dateVisits[dateKey]++;
  });
  
  // Convert dateVisits object to array of {date, count} for easier charting
  const timelineData = Object.entries(dateVisits)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  // Determine peak activity hours and days
  const peakHour = hourDistribution.indexOf(Math.max(...hourDistribution));
  const peakDay = dayDistribution.indexOf(Math.max(...dayDistribution));
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  return {
    hourlyDistribution: hourDistribution,
    dailyDistribution: dayDistribution,
    timelineData,
    peakActivityTime: {
      hour: peakHour,
      day: dayNames[peakDay]
    }
  };
};

/**
 * Analyze most frequently visited domains
 * @param {Array} historyItems - Array of browsing history items
 * @returns {Object} Domain frequency analysis
 */
const analyzeDomainFrequency = async (historyItems) => {
  const domainCount = {};
  
  historyItems.forEach(item => {
    try {
      const domain = new URL(item.url).hostname;
      if (!domainCount[domain]) {
        domainCount[domain] = 0;
      }
      domainCount[domain] += item.visitCount || 1;
    } catch (error) {
      // Skip invalid URLs
    }
  });
  
  // Sort domains by visit count
  const sortedDomains = Object.entries(domainCount)
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count);
  
  // Get top domains and their percentage of total visits
  const topDomains = sortedDomains.slice(0, 10);
  const totalVisits = sortedDomains.reduce((sum, item) => sum + item.count, 0);
  
  const topDomainsWithPercentage = topDomains.map(item => ({
    ...item,
    percentage: (item.count / totalVisits) * 100
  }));
  
  return {
    topDomains: topDomainsWithPercentage,
    totalUniqueDomainsVisited: sortedDomains.length,
    domainDiversity: sortedDomains.length / historyItems.length
  };
};

/**
 * Categorize websites by topic using NLP and domain knowledge
 * @param {Array} historyItems - Array of browsing history items
 * @returns {Object} Topic category analysis
 */
const analyzeTopicCategories = async (historyItems) => {
  // Select a sample of up to 50 most recent items for analysis
  // (to avoid exceeding API limits)
  const recentItems = [...historyItems]
    .sort((a, b) => new Date(b.lastVisitTime) - new Date(a.lastVisitTime))
    .slice(0, 50);
  
  // Prepare data for OpenAI analysis
  const urlsWithTitles = recentItems.map(item => ({
    url: item.url,
    title: item.title
  }));
  
  // Use OpenAI API to categorize the URLs
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Use gpt-3.5-turbo instead of gpt-4 to reduce token usage
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing web browsing behavior. Your task is to categorize URLs and their titles into topics and analyze the user's interests based on their browsing history. Return ONLY raw JSON without markdown formatting, code blocks, or any explanatory text."
        },
        {
          role: "user",
          content: `I need you to analyze this browsing history and categorize each item into topic categories. 
          Then provide an overall summary of the user's interests and browsing patterns.
          
          The format should be a JSON object with the following structure:
          {
            "categorizedItems": [
              {"url": "url1", "title": "title1", "category": "assigned category", "confidence": 0.8}
            ],
            "topicDistribution": {
              "category1": percentage,
              "category2": percentage
            },
            "primaryInterests": ["interest1", "interest2"],
            "secondaryInterests": ["interest3", "interest4"],
            "summary": "Brief analysis of user's browsing behavior and interests"
          }
          
          Here is the browsing history data:
          ${JSON.stringify(urlsWithTitles, null, 2)}`
        }
      ],
      temperature: 0.5,
    });
    
    // Parse the response with safe parsing
    const analysisResult = safeJSONParse(response.choices[0].message.content);
    
    // Add category icons for visualization
    const categoryIcons = {
      "Technology": "computer",
      "Education": "school",
      "Entertainment": "movie",
      "Shopping": "shopping_cart",
      "Social Media": "group",
      "News": "newspaper",
      "Finance": "attach_money",
      "Travel": "flight",
      "Health": "medical_services",
      "Sports": "sports_basketball",
      "Food": "restaurant",
      "Business": "business_center",
      "Productivity": "work",
      "Gaming": "sports_esports",
      "Reference": "menu_book"
    };
    
    // Add icons to the topic distribution
    const topicDistributionWithIcons = Object.entries(analysisResult.topicDistribution).map(([category, percentage]) => ({
      category,
      percentage,
      icon: categoryIcons[category] || "public"
    }));
    
    return {
      ...analysisResult,
      topicDistributionWithIcons,
      analysisTimestamp: new Date()
    };
  } catch (error) {
    console.error("Error in OpenAI categorization:", error);
    
    // Fallback to basic categorization if OpenAI fails
    return await fallbackCategorization(recentItems);
  }
};

/**
 * Analyze types of content user consumes (video, articles, shopping, etc.)
 * @param {Array} historyItems - Array of browsing history items
 * @returns {Object} Content type analysis
 */
const analyzeContentTypes = async (historyItems) => {
  // Define content type patterns
  const contentTypePatterns = {
    "Video": [
      { domain: "youtube.com", pattern: /youtube\.com\/watch/ },
      { domain: "vimeo.com" },
      { domain: "netflix.com" },
      { domain: "hulu.com" },
      { domain: "twitch.tv" },
      { domain: "dailymotion.com" },
      { pattern: /\.(mp4|avi|mov|wmv|flv|mkv)$/ }
    ],
    "Social Media": [
      { domain: "facebook.com" },
      { domain: "twitter.com" },
      { domain: "instagram.com" },
      { domain: "tiktok.com" },
      { domain: "linkedin.com" },
      { domain: "pinterest.com" },
      { domain: "reddit.com" },
      { domain: "snapchat.com" }
    ],
    "Shopping": [
      { domain: "amazon.com" },
      { domain: "ebay.com" },
      { domain: "etsy.com" },
      { domain: "walmart.com" },
      { domain: "target.com" },
      { domain: "bestbuy.com" },
      { pattern: /shop|store|product|cart|checkout/ }
    ],
    "News & Articles": [
      { domain: "nytimes.com" },
      { domain: "washingtonpost.com" },
      { domain: "cnn.com" },
      { domain: "bbc.com" },
      { domain: "medium.com" },
      { domain: "forbes.com" },
      { domain: "news." },
      { pattern: /article|blog|news/ }
    ],
    "Email & Communication": [
      { domain: "gmail.com" },
      { domain: "outlook.com" },
      { domain: "yahoo.com/mail" },
      { domain: "mail." },
      { domain: "chat." },
      { domain: "meet.google.com" },
      { domain: "zoom.us" },
      { domain: "teams.microsoft.com" }
    ],
    "Reference & Learning": [
      { domain: "wikipedia.org" },
      { domain: "stackoverflow.com" },
      { domain: "github.com" },
      { domain: "docs.google.com" },
      { domain: "coursera.org" },
      { domain: "udemy.com" },
      { domain: "edx.org" },
      { domain: "khanacademy.org" }
    ]
  };
  
  // Count content types
  const contentTypeCounts = {};
  Object.keys(contentTypePatterns).forEach(type => contentTypeCounts[type] = 0);
  contentTypeCounts["Other"] = 0;
  
  // Track websites per content type
  const websitesByType = {};
  Object.keys(contentTypePatterns).forEach(type => websitesByType[type] = {});
  websitesByType["Other"] = {};
  
  // Track categorized items for deeper analysis
  const categorizedItems = [];
  
  historyItems.forEach(item => {
    let matchedType = false;
    const url = item.url.toLowerCase();
    let domain = "";
    
    try {
      domain = new URL(url).hostname.toLowerCase();
    } catch (error) {
      // Invalid URL, skip
      return;
    }
    
    // Check each content type
    for (const [type, patterns] of Object.entries(contentTypePatterns)) {
      for (const pattern of patterns) {
        if (pattern.domain && domain.includes(pattern.domain)) {
          contentTypeCounts[type]++;
          matchedType = true;
          // Add to websites by type
          if (!websitesByType[type][domain]) {
            websitesByType[type][domain] = 0;
          }
          websitesByType[type][domain]++;
          categorizedItems.push({ ...item, contentType: type });
          break;
        } else if (pattern.pattern && pattern.pattern.test(url)) {
          contentTypeCounts[type]++;
          matchedType = true;
          // Add to websites by type
          if (!websitesByType[type][domain]) {
            websitesByType[type][domain] = 0;
          }
          websitesByType[type][domain]++;
          categorizedItems.push({ ...item, contentType: type });
          break;
        }
      }
      if (matchedType) break;
    }
    
    if (!matchedType) {
      contentTypeCounts["Other"]++;
      if (!websitesByType["Other"][domain]) {
        websitesByType["Other"][domain] = 0;
      }
      websitesByType["Other"][domain]++;
      categorizedItems.push({ ...item, contentType: "Other" });
    }
  });
  
  // Convert to percentages
  const total = Object.values(contentTypeCounts).reduce((sum, count) => sum + count, 0);
  const contentTypePercentages = {};
  
  for (const [type, count] of Object.entries(contentTypeCounts)) {
    contentTypePercentages[type] = (count / total) * 100;
  }
  
  // Create array format for charts
  const contentTypeDistribution = Object.entries(contentTypePercentages)
    .map(([type, percentage]) => ({ type, percentage, count: contentTypeCounts[type] }))
    .sort((a, b) => b.percentage - a.percentage);
  
  // Calculate content diversity (Shannon entropy)
  const nonZeroTypes = contentTypeDistribution.filter(item => item.percentage > 0);
  let entropy = 0;
  nonZeroTypes.forEach(item => {
    const p = item.percentage / 100;
    entropy -= p * Math.log2(p);
  });
  
  // Normalize entropy to a 0-100 scale
  // Max entropy is log2(n) where n is number of content types
  const maxPossibleEntropy = Math.log2(Object.keys(contentTypePatterns).length + 1); // +1 for "Other"
  const contentDiversity = (entropy / maxPossibleEntropy) * 100;
  
  // Get top websites for each content type
  const topWebsitesPerType = {};
  
  for (const [type, websites] of Object.entries(websitesByType)) {
    const sortedWebsites = Object.entries(websites)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3); // Get top 3
    
    topWebsitesPerType[type] = sortedWebsites;
  }
  
  // Calculate content engagement metrics
  const contentEngagement = {};
  
  // Average time spent per content type (if timestamps available)
  if (categorizedItems.length > 0 && categorizedItems[0].lastVisitTime) {
    // Group by day first
    const itemsByDay = {};
    
    categorizedItems.forEach(item => {
      const day = new Date(item.lastVisitTime).toISOString().split('T')[0];
      if (!itemsByDay[day]) {
        itemsByDay[day] = {};
      }
      
      if (!itemsByDay[day][item.contentType]) {
        itemsByDay[day][item.contentType] = 0;
      }
      
      itemsByDay[day][item.contentType]++;
    });
    
    // Calculate average engagement per day for each content type
    const contentTypeEngagement = {};
    Object.values(itemsByDay).forEach(dayData => {
      Object.entries(dayData).forEach(([type, count]) => {
        if (!contentTypeEngagement[type]) {
          contentTypeEngagement[type] = [];
        }
        contentTypeEngagement[type].push(count);
      });
    });
    
    // Calculate average daily engagement
    Object.entries(contentTypeEngagement).forEach(([type, counts]) => {
      const avgEngagement = counts.reduce((sum, count) => sum + count, 0) / counts.length;
      contentEngagement[type] = avgEngagement;
    });
  }
  
  return {
    contentTypeDistribution,
    primaryContentType: contentTypeDistribution[0]?.type || "None",
    contentDiversity: contentDiversity.toFixed(2),
    topWebsitesPerType,
    contentEngagement
  };
};

/**
 * Analyze user behavior patterns using machine learning techniques
 * @param {Array} historyItems - Array of browsing history items
 * @returns {Object} Behavior pattern analysis
 */
const analyzeUserBehaviorPatterns = async (historyItems) => {
  // Calculate session data
  const sessions = identifySessions(historyItems);
  
  // Calculate statistics about sessions
  const sessionDurations = sessions.map(session => session.duration);
  const averageSessionDuration = sessionDurations.length > 0
    ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length
    : 0;
  
  // Calculate browsing patterns
  const avgVisitsPerDay = calculateAverageVisitsPerDay(historyItems);
  const frequentPathways = identifyCommonPathways(sessions);
  const returningVisits = calculateReturningVisits(historyItems);
  
  // Identify weekday vs weekend patterns
  const weekdayVsWeekend = analyzeWeekdayWeekendPatterns(historyItems);
  
  return {
    sessionData: {
      count: sessions.length,
      averageDuration: averageSessionDuration, // in minutes
      averageSessionDepth: sessions.reduce((sum, session) => sum + session.items.length, 0) / sessions.length
    },
    browsingPatterns: {
      averageVisitsPerDay: avgVisitsPerDay,
      returningVisitRate: returningVisits.returningRate,
      topReturningDomains: returningVisits.topDomains.slice(0, 5),
      weekdayVsWeekend
    },
    commonPathways: frequentPathways.slice(0, 3)
  };
};

/**
 * Analyze detailed user behavior and habits using OpenAI's NLP
 * @param {Array} historyItems - Array of browsing history items
 * @returns {Object} Detailed behavior analysis
 */
const analyzeUserBehaviorDetails = async (historyItems) => {
  try {
    // Select up to 50 most recent items (reduced from 100) for detailed analysis to avoid rate limits
    const recentItems = [...historyItems]
      .sort((a, b) => new Date(b.lastVisitTime) - new Date(a.lastVisitTime))
      .slice(0, 50);
    
    // Prepare data for OpenAI analysis - include more context but limit detail to reduce token usage
    const historyData = recentItems.map(item => ({
      url: item.url,
      title: item.title || 'No Title',
      visitCount: item.visitCount || 1
      // Removed lastVisitTime to reduce token count
    }));
    
    // Use OpenAI for detailed behavioral analysis with gpt-3.5-turbo for lower token usage
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Use gpt-3.5-turbo instead of gpt-4 to avoid rate limits
      messages: [
        {
          role: "system",
          content: `You are an expert in digital behavior analysis, psychology, and user patterns.
          Your task is to perform a detailed analysis of a user's browsing history to identify:
          
          1. Behavioral patterns and habits
          2. Content preferences and interests
          3. Potential digital wellbeing insights
          4. Learning interests and knowledge-seeking behavior
          5. Entertainment preferences
          
          Provide nuanced insights that go beyond basic categorization.
          Return ONLY the raw JSON without any markdown formatting, code blocks, or explanatory text.`
        },
        {
          role: "user",
          content: `Analyze the following browsing history data in detail and provide rich insights about the user's behavior, habits, and potential digital wellbeing tips. 
          
          Return your analysis as a structured JSON object with the following structure:
          {
            "behavioralPatterns": {
              "contentPreferences": ["preference1", "preference2"],
              "timeUsageHabits": "detailed analysis",
              "attentionPatterns": "analysis of focus and switching",
              "recursiveInterests": ["interest1", "interest2"]
            },
            "contentInsights": {
              "primaryTopics": ["topic1", "topic2"],
              "secondaryTopics": ["topic3", "topic4"],
              "contentDepth": "analysis of shallow vs deep engagement",
              "varietyScore": 7
            },
            "digitalWellbeing": {
              "potentialChallenges": ["challenge1", "challenge2"],
              "healthyPatterns": ["pattern1", "pattern2"],
              "recommendations": ["tip1", "tip2"]
            },
            "learningBehavior": {
              "knowledgeSeeking": "assessment of learning patterns",
              "depthOfResearch": "shallow to deep scale",
              "educationalEngagement": "analysis of educational content",
              "skillDevelopment": ["potential skill1", "potential skill2"]
            },
            "keywordAnalysis": {
              "frequentTerms": ["term1", "term2"],
              "semanticTopics": ["topic1", "topic2"]
            },
            "insightSummary": "A detailed paragraph summarizing the most interesting and useful insights about this user's digital behavior"
          }
          
          Here is the browsing history data:
          ${JSON.stringify(historyData, null, 2)}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1500 // Reduced from 2000 to prevent too large responses
    });
    
    // Parse the response with safe parsing
    const behaviorInsights = safeJSONParse(response.choices[0].message.content);
    
    // Add any additional processing here if needed
    
    return behaviorInsights;
  } catch (error) {
    console.error('Error analyzing user behavior details:', error);
    return {
      error: 'Failed to analyze behavior details',
      message: error.message
    };
  }
};

/**
 * Identify user browsing sessions
 * @param {Array} historyItems - Array of browsing history items
 * @returns {Array} Session data
 */
const identifySessions = (historyItems) => {
  // Sort items by timestamp
  const sortedItems = [...historyItems].sort(
    (a, b) => new Date(a.lastVisitTime) - new Date(b.lastVisitTime)
  );
  
  const sessions = [];
  let currentSession = {
    startTime: null,
    endTime: null,
    items: []
  };
  
  // Session timeout threshold (30 minutes = 1800000 ms)
  const sessionThreshold = 1800000;
  
  sortedItems.forEach((item, index) => {
    const currentTime = new Date(item.lastVisitTime).getTime();
    
    if (index === 0) {
      // Start first session
      currentSession.startTime = currentTime;
      currentSession.items.push(item);
    } else {
      const previousTime = new Date(sortedItems[index - 1].lastVisitTime).getTime();
      const timeDiff = currentTime - previousTime;
      
      if (timeDiff > sessionThreshold) {
        // End previous session and start a new one
        currentSession.endTime = previousTime;
        currentSession.duration = (currentSession.endTime - currentSession.startTime) / 60000; // minutes
        sessions.push(currentSession);
        
        // Start new session
        currentSession = {
          startTime: currentTime,
          endTime: null,
          items: [item]
        };
      } else {
        // Add to current session
        currentSession.items.push(item);
      }
    }
    
    // Handle the last item
    if (index === sortedItems.length - 1) {
      currentSession.endTime = currentTime;
      currentSession.duration = (currentSession.endTime - currentSession.startTime) / 60000; // minutes
      sessions.push(currentSession);
    }
  });
  
  return sessions;
};

/**
 * Calculate average visits per day
 * @param {Array} historyItems - Array of browsing history items
 * @returns {Number} Average visits per day
 */
const calculateAverageVisitsPerDay = (historyItems) => {
  const visitDates = {};
  
  historyItems.forEach(item => {
    const dateKey = new Date(item.lastVisitTime).toISOString().split('T')[0];
    if (!visitDates[dateKey]) {
      visitDates[dateKey] = 0;
    }
    visitDates[dateKey]++;
  });
  
  const dayCount = Object.keys(visitDates).length;
  if (dayCount === 0) return 0;
  
  const totalVisits = Object.values(visitDates).reduce((sum, count) => sum + count, 0);
  return totalVisits / dayCount;
};

/**
 * Identify common browsing pathways within sessions
 * @param {Array} sessions - Array of browsing sessions
 * @returns {Array} Common pathways
 */
const identifyCommonPathways = (sessions) => {
  const pathways = [];
  
  sessions.forEach(session => {
    if (session.items.length < 2) return;
    
    for (let i = 0; i < session.items.length - 1; i++) {
      try {
        const fromDomain = new URL(session.items[i].url).hostname;
        const toDomain = new URL(session.items[i + 1].url).hostname;
        
        // Skip self-referential paths
        if (fromDomain === toDomain) continue;
        
        const existingPathwayIndex = pathways.findIndex(
          p => p.from === fromDomain && p.to === toDomain
        );
        
        if (existingPathwayIndex >= 0) {
          pathways[existingPathwayIndex].count++;
        } else {
          pathways.push({
            from: fromDomain,
            to: toDomain,
            count: 1
          });
        }
      } catch (error) {
        // Skip invalid URLs
      }
    }
  });
  
  return pathways.sort((a, b) => b.count - a.count);
};

/**
 * Calculate returning visits to domains
 * @param {Array} historyItems - Array of browsing history items
 * @returns {Object} Returning visit analysis
 */
const calculateReturningVisits = (historyItems) => {
  const domainVisitCounts = {};
  
  historyItems.forEach(item => {
    try {
      const domain = new URL(item.url).hostname;
      if (!domainVisitCounts[domain]) {
        domainVisitCounts[domain] = 0;
      }
      domainVisitCounts[domain]++;
    } catch (error) {
      // Skip invalid URLs
    }
  });
  
  // Calculate number of domains with multiple visits
  const multipleVisitDomains = Object.values(domainVisitCounts).filter(count => count > 1).length;
  const totalDomains = Object.keys(domainVisitCounts).length;
  const returningRate = totalDomains > 0 ? (multipleVisitDomains / totalDomains) * 100 : 0;
  
  // Sort domains by visit count
  const topReturningDomains = Object.entries(domainVisitCounts)
    .filter(([_, count]) => count > 1)
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count);
  
  return {
    returningRate,
    topDomains: topReturningDomains
  };
};

/**
 * Analyze weekday vs weekend browsing patterns
 * @param {Array} historyItems - Array of browsing history items
 * @returns {Object} Weekday vs weekend pattern analysis
 */
const analyzeWeekdayWeekendPatterns = (historyItems) => {
  let weekdayVisits = 0;
  let weekendVisits = 0;
  const weekdayHourDistribution = Array(24).fill(0);
  const weekendHourDistribution = Array(24).fill(0);
  
  historyItems.forEach(item => {
    const visitDate = new Date(item.lastVisitTime);
    const day = visitDate.getDay();
    const hour = visitDate.getHours();
    
    if (day === 0 || day === 6) { // 0 = Sunday, 6 = Saturday
      weekendVisits++;
      weekendHourDistribution[hour]++;
    } else {
      weekdayVisits++;
      weekdayHourDistribution[hour]++;
    }
  });
  
  const totalVisits = weekdayVisits + weekendVisits;
  
  return {
    weekdayPercentage: totalVisits > 0 ? (weekdayVisits / totalVisits) * 100 : 0,
    weekendPercentage: totalVisits > 0 ? (weekendVisits / totalVisits) * 100 : 0,
    weekdayHourDistribution,
    weekendHourDistribution,
    weekdayPeakHour: weekdayHourDistribution.indexOf(Math.max(...weekdayHourDistribution)),
    weekendPeakHour: weekendHourDistribution.indexOf(Math.max(...weekendHourDistribution))
  };
};

/**
 * Fallback categorization when OpenAI is unavailable
 * @param {Array} historyItems - Array of history items
 * @returns {Object} Basic categorization
 */
const fallbackCategorization = async (historyItems) => {
  const categoryPatterns = {
    "Technology": [
      "github.com", "stackoverflow.com", "medium.com", "dev.to", "techcrunch.com",
      "wired.com", "theverge.com", "cnet.com", "tech", "coding", "programming"
    ],
    "News": [
      "news", "cnn.com", "nytimes.com", "bbc.com", "reuters.com", "washingtonpost.com",
      "bloomberg.com", "wsj.com", "article", "blog"
    ],
    "Social Media": [
      "facebook.com", "twitter.com", "instagram.com", "reddit.com", "linkedin.com",
      "pinterest.com", "tiktok.com", "snapchat.com", "social"
    ],
    "Entertainment": [
      "youtube.com", "netflix.com", "hulu.com", "disney.com", "spotify.com",
      "twitch.tv", "movie", "music", "game", "play", "stream"
    ],
    "Shopping": [
      "amazon.com", "ebay.com", "etsy.com", "walmart.com", "target.com",
      "shop", "store", "buy", "product", "price", "deal"
    ],
    "Education": [
      "coursera.org", "udemy.com", "khanacademy.org", "edx.org", "duolingo.com",
      "learn", "course", "class", "education", "university", "school"
    ],
    "Finance": [
      "finance", "bank", "invest", "money", "stock", "crypto", "bitcoin",
      "paypal.com", "mint.com", "chase.com", "capitalone.com"
    ],
    "Health": [
      "health", "fitness", "workout", "diet", "nutrition", "medical", "doctor",
      "webmd.com", "mayoclinic.org", "fitbit.com", "strava.com"
    ]
  };
  
  const categoryCounts = {};
  Object.keys(categoryPatterns).forEach(category => {
    categoryCounts[category] = 0;
  });
  
  historyItems.forEach(item => {
    const combined = (item.url + " " + (item.title || "")).toLowerCase();
    let matched = false;
    
    for (const [category, patterns] of Object.entries(categoryPatterns)) {
      for (const pattern of patterns) {
        if (combined.includes(pattern)) {
          categoryCounts[category]++;
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
    
    if (!matched) {
      if (!categoryCounts["Other"]) categoryCounts["Other"] = 0;
      categoryCounts["Other"]++;
    }
  });
  
  // Convert to distribution
  const total = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);
  const topicDistribution = {};
  
  for (const [category, count] of Object.entries(categoryCounts)) {
    if (count > 0) {
      topicDistribution[category] = (count / total) * 100;
    }
  }
  
  // Sort categories by percentage
  const sortedCategories = Object.entries(topicDistribution)
    .sort(([, aPercent], [, bPercent]) => bPercent - aPercent);
  
  // Get primary and secondary interests
  const primaryInterests = sortedCategories.slice(0, 2).map(([category]) => category);
  const secondaryInterests = sortedCategories.slice(2, 5).map(([category]) => category);
  
  // Add category icons for visualization
  const categoryIcons = {
    "Technology": "computer",
    "Education": "school",
    "Entertainment": "movie",
    "Shopping": "shopping_cart",
    "Social Media": "group",
    "News": "newspaper",
    "Finance": "attach_money",
    "Travel": "flight",
    "Health": "medical_services",
    "Sports": "sports_basketball",
    "Food": "restaurant",
    "Business": "business_center",
    "Productivity": "work",
    "Gaming": "sports_esports",
    "Reference": "menu_book"
  };
  
  // Create topicDistributionWithIcons array for charts
  const topicDistributionWithIcons = Object.entries(topicDistribution).map(([category, percentage]) => ({
    category,
    percentage,
    icon: categoryIcons[category] || "public"
  }));
  
  // Generate an enhanced summary
  const summary = generateEnhancedSummary(historyItems, primaryInterests, secondaryInterests, sortedCategories);
  
  return {
    categorizedItems: historyItems.map(item => ({
      url: item.url,
      title: item.title,
      category: "Unknown",
      confidence: 0
    })),
    topicDistribution,
    topicDistributionWithIcons,
    primaryInterests,
    secondaryInterests,
    summary
  };
};

/**
 * Generate an enhanced summary that mimics NLP analysis
 * @param {Array} historyItems - Array of history items
 * @param {Array} primaryInterests - Primary interest categories
 * @param {Array} secondaryInterests - Secondary interest categories
 * @param {Array} sortedCategories - All categories sorted by percentage
 * @returns {String} Enhanced summary
 */
const generateEnhancedSummary = (historyItems, primaryInterests, secondaryInterests, sortedCategories) => {
  if (primaryInterests.length === 0) {
    return "Based on the available browsing data, no clear pattern of interests could be determined. This may be due to limited browsing history data or highly diverse browsing habits.";
  }
  
  const totalVisits = historyItems.length;
  
  // Extract unique domains
  const domains = [...new Set(historyItems.map(item => {
    try {
      return new URL(item.url).hostname;
    } catch (error) {
      return null;
    }
  }).filter(domain => domain !== null))];
  
  // Calculate time span of browsing history
  const timestamps = historyItems.map(item => new Date(item.lastVisitTime).getTime());
  const oldestTimestamp = Math.min(...timestamps);
  const newestTimestamp = Math.max(...timestamps);
  const daySpan = Math.ceil((newestTimestamp - oldestTimestamp) / (1000 * 60 * 60 * 24)) || 1;
  
  // Build the summary
  let summary = `Based on the analysis of ${totalVisits} pages visited across ${domains.length} unique websites over approximately ${daySpan} days, your primary interests appear to be ${primaryInterests.join(' and ')}. `;
  
  if (secondaryInterests.length > 0) {
    summary += `You also show significant interest in ${secondaryInterests.join(', ')}. `;
  }
  
  // Add time-based insights
  const hourDistribution = Array(24).fill(0);
  const dayDistribution = Array(7).fill(0);
  
  historyItems.forEach(item => {
    const visitDate = new Date(item.lastVisitTime);
    hourDistribution[visitDate.getHours()]++;
    dayDistribution[visitDate.getDay()]++;
  });
  
  const peakHour = hourDistribution.indexOf(Math.max(...hourDistribution));
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const peakDay = days[dayDistribution.indexOf(Math.max(...dayDistribution))];
  
  summary += `Your browsing activity peaks around ${peakHour}:00 and ${peakDay} tends to be your most active day. `;
  
  // Add content type insights
  if (sortedCategories.length > 0) {
    const topCategory = sortedCategories[0][0];
    
    if (topCategory === "Technology") {
      summary += "You appear to be very interested in technology-related content, suggesting you may work in IT, software development, or are passionate about tech innovations.";
    } else if (topCategory === "Education") {
      summary += "Your strong focus on educational resources suggests you may be a student, educator, or someone committed to lifelong learning.";
    } else if (topCategory === "Entertainment") {
      summary += "Your browsing shows a strong preference for entertainment content, indicating you value leisure time and staying current with media and culture.";
    } else if (topCategory === "Shopping") {
      summary += "Your browsing activity shows significant time spent on shopping websites, indicating you might be researching products or enjoy online shopping.";
    } else if (topCategory === "Social Media") {
      summary += "Your browsing reveals substantial social media usage, suggesting you value staying connected with friends, family, or professional networks.";
    } else if (topCategory === "News") {
      summary += "Your browsing indicates you're a news-conscious individual who stays informed about current events and developments.";
    } else {
      summary += `Your browsing data suggests a strong interest in ${topCategory.toLowerCase()}-related content and activities.`;
    }
  }
  
  return summary;
};

module.exports = {
  analyzeUserHistory,
  analyzeVisitTimeDistribution,
  analyzeDomainFrequency,
  analyzeTopicCategories,
  analyzeContentTypes,
  analyzeUserBehaviorPatterns,
  analyzeUserBehaviorDetails
}; 