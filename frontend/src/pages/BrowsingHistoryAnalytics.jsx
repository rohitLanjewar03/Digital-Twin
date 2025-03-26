import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import { useHistory } from '../context/HistoryContext';
import {
  BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, Cell, RadarChart, Radar, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, Sector
} from 'recharts';
import '../styles/BrowsingHistoryAnalytics.css';

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28BFF',
  '#FF6B6B', '#54D182', '#FFC857', '#63C5DA', '#B0A8B9',
  '#845EC2', '#D65DB1', '#FF9671', '#FFC75F', '#F9F871'
];

const BrowsingHistoryAnalytics = () => {
  const { user } = useAuth();
  const { fetchHistory } = useHistory();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  
  // Fetch analytics data
  const fetchAnalytics = async (forceRefresh = false) => {
    setRefreshing(true);
    setError(null);
    
    try {
      const email = user?.email || localStorage.getItem('browsing_history_email');
      
      if (!email) {
        setError('Email is required to fetch analytics');
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      const cacheParam = forceRefresh ? 'cache=false' : '';
      const response = await fetch(`http://localhost:5000/history/analytics-by-email?email=${encodeURIComponent(email)}&${cacheParam}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setAnalytics(data.analysis);
      setLastFetched(new Date(data.analysisTimestamp));
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Initial fetch
  useEffect(() => {
    fetchAnalytics();
    
    // Set the email in localStorage if user is logged in
    if (user?.email) {
      localStorage.setItem('browsing_history_email', user.email);
    }
  }, [user]);
  
  // Helper for pie chart animation
  const onPieEnter = (_, index) => {
    setActiveIndex(index);
  };
  
  // Render active shape for the pie chart
  const renderActiveShape = (props) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle,
      fill, payload, percent, value } = props;
  
    return (
      <g>
        <text x={cx} y={cy} dy={-20} textAnchor="middle" fill={fill}>
          {payload.category || payload.domain || payload.type}
        </text>
        <text x={cx} y={cy} dy={10} textAnchor="middle" fill="#333">
          {value} visits
        </text>
        <text x={cx} y={cy} dy={30} textAnchor="middle" fill="#999">
          {`(${(percent * 100).toFixed(2)}%)`}
        </text>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 10}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
      </g>
    );
  };
  
  // Format hour labels for time charts
  const formatHour = (hour) => {
    return `${hour}:00`;
  };
  
  // Format day labels for day charts
  const formatDay = (day) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[day];
  };
  
  // Helper function to get full day name
  const getFullDayName = (day) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day];
  };
  
  // Return appropriate color for day of week
  const getDayColor = (dayIndex) => {
    const dayColors = [
      '#FF8042', // Sunday - orange
      '#0088FE', // Monday - blue
      '#00C49F', // Tuesday - green
      '#FFBB28', // Wednesday - yellow
      '#A28BFF', // Thursday - purple
      '#FF6B6B', // Friday - red
      '#54D182'  // Saturday - green
    ];
    return dayColors[dayIndex % dayColors.length];
  };
  
  // Get activity pattern description based on hourly distribution
  const getActivityPattern = (hourlyDistribution) => {
    if (!hourlyDistribution || hourlyDistribution.length === 0) {
      return 'No activity pattern data available';
    }
    
    // Find morning, afternoon, evening peaks
    const morning = hourlyDistribution.slice(5, 12).reduce((sum, count) => sum + count, 0);
    const afternoon = hourlyDistribution.slice(12, 18).reduce((sum, count) => sum + count, 0);
    const evening = hourlyDistribution.slice(18, 24).reduce((sum, count) => sum + count, 0);
    
    const total = morning + afternoon + evening;
    if (total === 0) return 'No significant activity detected';
    
    const morningPct = (morning / total) * 100;
    const afternoonPct = (afternoon / total) * 100;
    const eveningPct = (evening / total) * 100;
    
    if (morningPct > 50) {
      return 'You are primarily a morning browser, with most activity happening before noon.';
    } else if (afternoonPct > 50) {
      return 'Your browsing is concentrated in the afternoon hours.';
    } else if (eveningPct > 50) {
      return 'You are an evening browser, with most activity after 6 PM.';
    } else if (morningPct > afternoonPct && morningPct > eveningPct) {
      return 'You tend to browse more in the morning, though your activity is spread throughout the day.';
    } else if (afternoonPct > morningPct && afternoonPct > eveningPct) {
      return 'Your peak browsing happens in the afternoon, though you are active at other times too.';
    } else if (eveningPct > morningPct && eveningPct > afternoonPct) {
      return 'You prefer evening browsing, though you are also active at other times of day.';
    } else {
      return 'Your browsing activity is fairly evenly distributed throughout the day.';
    }
  };
  
  // Calculate percentage of activity in a specific time range
  const calculateTimeOfDayPercentage = (hourlyDistribution, startHour, endHour) => {
    if (!hourlyDistribution || hourlyDistribution.length === 0) return 0;
    
    const rangeTotal = hourlyDistribution.slice(startHour, endHour + 1).reduce((sum, count) => sum + count, 0);
    const total = hourlyDistribution.reduce((sum, count) => sum + count, 0);
    
    return total === 0 ? 0 : ((rangeTotal / total) * 100).toFixed(1);
  };
  
  // Get weekday pattern description
  const getWeekdayPattern = (dailyDistribution) => {
    if (!dailyDistribution || dailyDistribution.length === 0) {
      return 'No weekday pattern data available';
    }
    
    // Calculate weekday vs weekend activity
    const weekday = dailyDistribution.slice(1, 6).reduce((sum, count) => sum + count, 0); // Mon-Fri
    const weekend = dailyDistribution[0] + dailyDistribution[6]; // Sun + Sat
    
    const total = weekday + weekend;
    if (total === 0) return 'No significant activity detected';
    
    const weekdayPct = (weekday / total) * 100;
    const weekendPct = (weekend / total) * 100;
    
    // Find the peak day
    const peakDayIndex = dailyDistribution.indexOf(Math.max(...dailyDistribution));
    const peakDay = getFullDayName(peakDayIndex);
    
    if (weekdayPct > 80) {
      return `Your browsing is almost exclusively on weekdays, with ${peakDay} being your most active day.`;
    } else if (weekendPct > 80) {
      return `You primarily browse on weekends, with ${peakDay} showing the highest activity.`;
    } else if (weekdayPct > 60) {
      return `You browse more on weekdays than weekends, with peak activity on ${peakDay}.`;
    } else if (weekendPct > 60) {
      return `Your browsing is concentrated on weekends, with ${peakDay} being particularly active.`;
    } else {
      return `Your browsing is fairly evenly distributed between weekdays and weekends, with a slight preference for ${weekdayPct > weekendPct ? 'weekdays' : 'weekends'} and peak activity on ${peakDay}.`;
    }
  };
  
  // Get the peak day of the week
  const getPeakDay = (dailyDistribution) => {
    if (!dailyDistribution || dailyDistribution.length === 0) return 'N/A';
    
    const peakDayIndex = dailyDistribution.indexOf(Math.max(...dailyDistribution));
    return getFullDayName(peakDayIndex);
  };
  
  // Calculate peak day percentage
  const calculatePeakDayPercentage = (dailyDistribution) => {
    if (!dailyDistribution || dailyDistribution.length === 0) return 0;
    
    const peakValue = Math.max(...dailyDistribution);
    const total = dailyDistribution.reduce((sum, count) => sum + count, 0);
    
    return total === 0 ? 0 : ((peakValue / total) * 100).toFixed(1);
  };
  
  // Calculate percentage for a group of days
  const calculateDayGroupPercentage = (dailyDistribution, dayIndices) => {
    if (!dailyDistribution || dailyDistribution.length === 0) return 0;
    
    const groupTotal = dayIndices.reduce((sum, dayIndex) => sum + (dailyDistribution[dayIndex] || 0), 0);
    const total = dailyDistribution.reduce((sum, count) => sum + count, 0);
    
    return total === 0 ? 0 : ((groupTotal / total) * 100).toFixed(1);
  };
  
  const handleRefresh = () => {
    fetchAnalytics(true);
  };
  
  // Helper function to get insight about content type
  const getContentTypeInsight = (contentType) => {
    if (!contentType) return '';
    
    const insights = {
      "Video": "You spend a significant amount of time consuming video content. This might include educational videos, entertainment, tutorials, or live streams.",
      "Social Media": "A large portion of your browsing involves social networking. You might be using these platforms for personal connections, professional networking, or content discovery.",
      "Shopping": "Your browsing shows considerable time spent on e-commerce and shopping sites. You may be researching products or making regular online purchases.",
      "News & Articles": "You dedicate significant time to staying informed about current events and reading articles across various topics.",
      "Email & Communication": "A notable portion of your online time is spent on communication platforms, suggesting you actively maintain digital correspondence.",
      "Reference & Learning": "Your browsing habits indicate a strong focus on knowledge acquisition and educational resources.",
      "Other": "Your content consumption is quite diverse and doesn't fit neatly into common categories."
    };
    
    return insights[contentType] || `You show a preference for ${contentType.toLowerCase()} content.`;
  };
  
  // Helper function to determine content diversity
  const getContentDiversitySummary = (contentDistribution) => {
    if (!contentDistribution || contentDistribution.length === 0) return 'unavailable';
    
    if (contentDistribution.length <= 2) {
      return 'highly focused on a narrow range of content types';
    } else if (contentDistribution.length <= 4) {
      return 'moderately diverse with a few primary content types';
    } else {
      return 'highly diverse across multiple content categories';
    }
  };
  
  // Calculate percentage of top 3 content types
  const getTopContentPercentage = (contentDistribution) => {
    if (!contentDistribution || contentDistribution.length < 3) return 0;
    
    const top3Sum = contentDistribution
      .slice(0, 3)
      .reduce((sum, item) => sum + item.percentage, 0);
      
    return top3Sum.toFixed(1);
  };
  
  // Helper function to describe content diversity score
  const getContentDiversityDescription = (diversityScore) => {
    const score = parseFloat(diversityScore);
    if (score >= 80) {
      return "an extremely diverse range of content consumption";
    } else if (score >= 60) {
      return "a very balanced content diet";
    } else if (score >= 40) {
      return "a moderately diverse content consumption";
    } else if (score >= 20) {
      return "a somewhat focused content consumption pattern";
    } else {
      return "a highly specialized focus in your content consumption";
    }
  };
  
  // Calculate the percentage that primary interests represent in overall browsing
  const calculatePrimaryInterestsPercentage = (topicDistribution, primaryInterests) => {
    if (!topicDistribution || topicDistribution.length === 0 || !primaryInterests || primaryInterests.length === 0) return 0;
    
    const primaryPercentage = topicDistribution
      .filter(item => primaryInterests.includes(item.category))
      .reduce((sum, item) => sum + item.percentage, 0);
      
    return primaryPercentage.toFixed(1);
  };
  
  // Get top categories percentage
  const getTopCategoriesPercentage = (topicDistribution) => {
    if (!topicDistribution || topicDistribution.length < 3) return 0;
    
    const top3Sum = topicDistribution
      .slice(0, 3)
      .reduce((sum, item) => sum + item.percentage, 0);
      
    return top3Sum.toFixed(1);
  };
  
  // Determine interest diversity level
  const getInterestDiversityLevel = (topicDistribution) => {
    if (!topicDistribution || topicDistribution.length === 0) return " limited range of interests";
    
    const totalCategories = topicDistribution.length;
    const topCategoryPercentage = topicDistribution[0]?.percentage || 0;
    
    if (totalCategories >= 7) {
      return " highly diverse range of interests";
    } else if (totalCategories >= 5) {
      return " broad spectrum of interests";
    } else if (totalCategories >= 3) {
      return " moderate diversity of interests";
    } else if (topCategoryPercentage > 70) {
      return " very focused range of interests";
    } else {
      return " specialized set of interests";
    }
  };
  
  // Helper function to compare a value to an average
  const compareToAverage = (value, average, positiveComparison, negativeComparison) => {
    if (value > average) {
      return <span className="positive-comparison">{positiveComparison}</span>;
    } else if (value < average) {
      return <span className="negative-comparison">{negativeComparison}</span>;
    } else {
      return <span className="neutral-comparison">neutral</span>;
    }
  };
  
  // Helper function to get session insight
  const getSessionInsight = (sessionData) => {
    if (!sessionData) return '';
    
    const { averageDuration = 0, averageSessionDepth = 0, count = 0 } = sessionData;
    return (
      <div>
        <p>
          Your average browsing session duration is {averageDuration.toFixed(1)} minutes.
          {averageDuration > 15 ? (
            <span className="positive-comparison"> This is longer than the average session duration.</span>
          ) : (
            <span className="negative-comparison"> This is shorter than the average session duration.</span>
          )}
        </p>
        <p>
          Your average session depth is {averageSessionDepth.toFixed(1)} pages.
          {averageSessionDepth > 2 ? (
            <span className="positive-comparison"> This is deeper than the average session depth.</span>
          ) : (
            <span className="negative-comparison"> This is shallower than the average session depth.</span>
          )}
        </p>
        <p>
          You have had {count} distinct browsing sessions.
        </p>
      </div>
    );
  };
  
  // Helper function to get behavior summary
  const getBehaviorSummary = (behaviorPatterns) => {
    if (!behaviorPatterns) return '';
    
    const { averageDuration } = behaviorPatterns.sessionData || {};
    const { averageVisitsPerDay, returningVisitRate, weekdayVsWeekend } = behaviorPatterns.browsingPatterns || {};
    
    return (
      <div>
        <p>
          Your average browsing session duration is {(averageDuration || 0).toFixed(1)} minutes.
          {averageDuration > 15 ? (
            <span className="positive-comparison"> This is longer than the average session duration.</span>
          ) : (
            <span className="negative-comparison"> This is shorter than the average session duration.</span>
          )}
        </p>
        <p>
          Your average daily visits are {(averageVisitsPerDay || 0).toFixed(1)} pages.
          {averageVisitsPerDay > 25 ? (
            <span className="positive-comparison"> This is more than the average daily visits.</span>
          ) : (
            <span className="negative-comparison"> This is fewer than the average daily visits.</span>
          )}
        </p>
        <p>
          Your returning visit rate is {(returningVisitRate || 0).toFixed(1)}%.
          {returningVisitRate > 40 ? (
            <span className="positive-comparison"> This is higher than the average returning visit rate.</span>
          ) : (
            <span className="negative-comparison"> This is lower than the average returning visit rate.</span>
          )}
        </p>
        <p>
          Your browsing activity is {(weekdayVsWeekend?.weekdayPercentage || 0) > 50 ? (
            <span className="positive-comparison">primarily on weekdays</span>
          ) : (
            <span className="negative-comparison">primarily on weekends</span>
          )}, with peak hours at {weekdayVsWeekend?.weekdayPeakHour || 0}:00 on weekdays and {weekdayVsWeekend?.weekendPeakHour || 0}:00 on weekends.
        </p>
      </div>
    );
  };
  
  // Render detailed behavior analysis section
  const BehaviorDetailsSection = ({ behaviorDetails }) => {
    if (!behaviorDetails || behaviorDetails.error) {
      return (
        <div className="analytics-section">
          <h2>Detailed Behavior Analysis</h2>
          <p className="text-muted">
            {behaviorDetails?.error || 'Detailed behavior analysis not available.'}
          </p>
        </div>
      );
    }

    const {
      behavioralPatterns,
      contentInsights,
      digitalWellbeing,
      learningBehavior,
      keywordAnalysis,
      insightSummary
    } = behaviorDetails;

    return (
      <div className="analytics-section behavior-details">
        <h2>Detailed Behavior Analysis</h2>
        
        <div className="insight-summary">
          <h3>Insight Summary</h3>
          <p className="summary-text">{insightSummary}</p>
        </div>
        
        <div className="behavior-grid">
          <div className="behavior-card">
            <h3>Content Preferences</h3>
            <ul className="tag-list">
              {behavioralPatterns.contentPreferences.map((pref, idx) => (
                <li key={idx} className="tag">{pref}</li>
              ))}
            </ul>
            <div><strong>Time Usage:</strong> {behavioralPatterns.timeUsageHabits}</div>
            <div><strong>Attention:</strong> {behavioralPatterns.attentionPatterns}</div>
          </div>
          
          <div className="behavior-card">
            <h3>Content Topics</h3>
            <div className="topics-container">
              <div>
                <h4>Primary</h4>
                <ul className="tag-list primary">
                  {contentInsights.primaryTopics.map((topic, idx) => (
                    <li key={idx} className="tag primary">{topic}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Secondary</h4>
                <ul className="tag-list secondary">
                  {contentInsights.secondaryTopics.map((topic, idx) => (
                    <li key={idx} className="tag secondary">{topic}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div><strong>Content Depth:</strong> {contentInsights.contentDepth}</div>
            <div><strong>Variety Score:</strong> {contentInsights.varietyScore}/10</div>
          </div>
          
          <div className="behavior-card">
            <h3>Digital Wellbeing</h3>
            <div className="wellbeing-container">
              <div>
                <h4>Potential Challenges</h4>
                <ul className="challenges-list">
                  {digitalWellbeing.potentialChallenges.map((challenge, idx) => (
                    <li key={idx}>{challenge}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Healthy Patterns</h4>
                <ul className="healthy-list">
                  {digitalWellbeing.healthyPatterns.map((pattern, idx) => (
                    <li key={idx}>{pattern}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="recommendations">
              <h4>Recommendations</h4>
              <ul className="recommendations-list">
                {digitalWellbeing.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>
          
          <div className="behavior-card">
            <h3>Learning Behavior</h3>
            <div><strong>Knowledge Seeking:</strong> {learningBehavior.knowledgeSeeking}</div>
            <div><strong>Research Depth:</strong> {learningBehavior.depthOfResearch}</div>
            <div><strong>Educational Engagement:</strong> {learningBehavior.educationalEngagement}</div>
            <h4>Potential Skills</h4>
            <ul className="skills-list">
              {learningBehavior.skillDevelopment.map((skill, idx) => (
                <li key={idx}>{skill}</li>
              ))}
            </ul>
          </div>
          
          <div className="behavior-card">
            <h3>Keyword Analysis</h3>
            <div>
              <h4>Frequent Terms</h4>
              <div className="keyword-cloud">
                {keywordAnalysis.frequentTerms.map((term, idx) => (
                  <span key={idx} className="keyword" style={{ fontSize: `${100 + (idx < 5 ? (5-idx)*20 : 0)}%` }}>
                    {term}
                  </span>
                ))}
              </div>
              <h4>Semantic Topics</h4>
              <ul className="semantic-list">
                {keywordAnalysis.semanticTopics.map((topic, idx) => (
                  <li key={idx}>{topic}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  if (loading && !analytics) {
    return (
      <div className="browsing-history-analytics-page">
        <div className="loading">Loading analytics data...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="browsing-history-analytics-page">
        <div className="error-message">{error}</div>
        <div className="no-data-actions">
          <button className="refresh-button" onClick={handleRefresh}>
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  if (!analytics) {
    return (
      <div className="browsing-history-analytics-page">
        <div className="no-data">
          <p>No analytics data available.</p>
          <p>Make sure you have browsing history data collected.</p>
        </div>
        <div className="no-data-actions">
          <button className="refresh-button" onClick={handleRefresh}>
            Refresh
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="browsing-history-analytics-page">
      <div className="header">
        <h1>Browsing History Analytics</h1>
        <div className="actions">
          <button 
            className="refresh-button"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Analysis'}
          </button>
          {lastFetched && (
            <span className="last-refresh">
              Last analyzed: {lastFetched.toLocaleString()}
            </span>
          )}
        </div>
      </div>
      
      <div className="analytics-summary">
        <div className="summary-card">
          <h3>Total Pages Visited</h3>
          <div className="summary-value">{analytics.totalItems || 0}</div>
        </div>
        <div className="summary-card">
          <h3>Unique Websites</h3>
          <div className="summary-value">{analytics.domainFrequency?.totalUniqueDomainsVisited || 0}</div>
        </div>
        <div className="summary-card">
          <h3>Peak Activity Time</h3>
          <div className="summary-value">
            {analytics.timeDistribution?.peakActivityTime?.hour || 0}:00 on {analytics.timeDistribution?.peakActivityTime?.day || 'N/A'}
          </div>
        </div>
        <div className="summary-card">
          <h3>Primary Content Type</h3>
          <div className="summary-value">{analytics.contentTypes?.primaryContentType || 'N/A'}</div>
        </div>
      </div>
      
      <div className="analytics-grid">
        {/* Topic Categories Chart */}
        <div className="analytics-card categories-card">
          <h2>Browsing Categories & Interests</h2>
          <p className="section-description">
            This analysis shows the topics and categories you browse most frequently, revealing your online interests and preferences.
          </p>
          <div className="chart-container categories-container">
            <div className="categories-chart">
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    activeIndex={activeIndex}
                    activeShape={renderActiveShape}
                    data={analytics.topicCategories?.topicDistributionWithIcons || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="percentage"
                    onMouseEnter={onPieEnter}
                    paddingAngle={2}
                  >
                    {analytics.topicCategories?.topicDistributionWithIcons?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="#ffffff" strokeWidth={2} />
                    )) || []}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [`${value.toFixed(1)}%`, 'Percentage']}
                    labelFormatter={(name, entry) => entry.payload.category}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="categories-insights">
              <div className="category-insight-card">
                <h3>Category Distribution</h3>
                <div className="category-legend">
                  {analytics.topicCategories?.topicDistributionWithIcons?.map((item, index) => (
                    <div key={index} className="category-legend-item">
                      <div className="category-color" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <div className="category-name">{item.category}</div>
                      <div className="category-percent">{item.percentage.toFixed(1)}%</div>
                    </div>
                  )) || <div>No category data available</div>}
                </div>
              </div>
              <div className="category-stat-cards">
                <div className="category-stat-card">
                  <h4>Primary Category</h4>
                  <div className="category-stat-value">
                    {analytics.topicCategories?.primaryInterests?.[0] || 'N/A'}
                  </div>
                  <div className="category-stat-percent">
                    {analytics.topicCategories?.topicDistributionWithIcons?.[0]?.percentage.toFixed(1)}% of browsing
                  </div>
                </div>
                <div className="category-stat-card">
                  <h4>Categorized Pages</h4>
                  <div className="category-stat-value">
                    {analytics.topicCategories?.categorizedItems?.length || 0}
                  </div>
                  <div className="category-stat-percent">
                    {analytics.totalItems ? ((analytics.topicCategories?.categorizedItems?.length || 0) / analytics.totalItems * 100).toFixed(1) : 0}% of total
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="interests-summary">
            <div className="primary-interests">
              <h3>Primary Interests</h3>
              <ul>
                {analytics.topicCategories?.primaryInterests?.map((interest, index) => (
                  <li key={index}>{interest}</li>
                )) || <li>No primary interests found</li>}
              </ul>
              <div className="interest-insight">
                Primary interests represent your most frequently visited categories and account for approximately 
                {analytics.topicCategories?.topicDistributionWithIcons?.length > 0 && analytics.topicCategories?.primaryInterests?.length > 0 ? 
                  ` ${calculatePrimaryInterestsPercentage(analytics.topicCategories.topicDistributionWithIcons, analytics.topicCategories.primaryInterests)}%` 
                  : ' N/A'} of your browsing activity.
              </div>
            </div>
            <div className="secondary-interests">
              <h3>Secondary Interests</h3>
              <ul>
                {analytics.topicCategories?.secondaryInterests?.map((interest, index) => (
                  <li key={index}>{interest}</li>
                )) || <li>No secondary interests found</li>}
              </ul>
              <div className="interest-insight">
                Secondary interests complement your main focus areas and help build a more complete picture of your online behavior.
              </div>
            </div>
          </div>
          <div className="categories-detail-section">
            <h3>Interest Diversity Analysis</h3>
            <p className="categories-analysis-text">
              Your browsing interests show a 
              {getInterestDiversityLevel(analytics.topicCategories?.topicDistributionWithIcons)}. 
              This analysis is based on {analytics.totalItems || 0} pages visited across {analytics.domainFrequency?.totalUniqueDomainsVisited || 0} unique domains.
              {analytics.topicCategories?.topicDistributionWithIcons?.length > 3 ? 
                ` Your top three categories represent ${getTopCategoriesPercentage(analytics.topicCategories.topicDistributionWithIcons)}% of your total browsing.` 
                : ''}
            </p>
          </div>
        </div>
        
        {/* Top Domains Chart */}
        <div className="analytics-card domains-card">
          <h2>Most Visited Websites</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={analytics.domainFrequency?.topDomains || []}
                layout="vertical"
                margin={{ top: 20, right: 30, left: 60, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis 
                  dataKey="domain" 
                  type="category" 
                  width={150}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  formatter={(value, name, props) => [`${value} visits (${props.payload.percentage.toFixed(1)}%)`, 'Visits']}
                  labelFormatter={(value) => `Domain: ${value}`}
                />
                <Bar dataKey="count" fill="#8884d8">
                  {analytics.domainFrequency?.topDomains?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  )) || []}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Hourly Activity Chart */}
        <div className="analytics-card time-card">
          <h2>Time of Day Activity</h2>
          <p className="section-description">
            This analysis shows when you're most active online throughout the day, helping identify your peak browsing hours.
          </p>
          <div className="time-activity-container">
            <div className="time-chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={(analytics.timeDistribution?.hourlyDistribution || []).map((count, hour) => ({
                    hour,
                    count
                  }))}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="hour" 
                    tickFormatter={formatHour}
                    ticks={[0, 3, 6, 9, 12, 15, 18, 21, 23]}
                  />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => [`${value} visits`, 'Page Views']}
                    labelFormatter={(hour) => `Time: ${formatHour(hour)}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#8884d8" 
                    activeDot={{ r: 8 }}
                    strokeWidth={2} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="time-insights">
              <div className="time-insight-card">
                <h3>Peak Activity Hours</h3>
                <div className="time-summary">
                  <div className="peak-time-display">
                    <div className="peak-time-value">{analytics.timeDistribution?.peakActivityTime?.hour || 0}:00</div>
                    <div className="peak-time-label">Peak Hour</div>
                  </div>
                  <div className="activity-pattern">
                    <h4>Activity Pattern</h4>
                    <p>{getActivityPattern(analytics.timeDistribution?.hourlyDistribution)}</p>
                  </div>
                </div>
              </div>
              <div className="time-stats">
                <div className="time-stat-card">
                  <h4>Morning Activity</h4>
                  <div className="time-stat-value">{calculateTimeOfDayPercentage(analytics.timeDistribution?.hourlyDistribution, 5, 11)}%</div>
                  <div className="time-stat-label">5:00 - 11:59</div>
                </div>
                <div className="time-stat-card">
                  <h4>Afternoon Activity</h4>
                  <div className="time-stat-value">{calculateTimeOfDayPercentage(analytics.timeDistribution?.hourlyDistribution, 12, 17)}%</div>
                  <div className="time-stat-label">12:00 - 17:59</div>
                </div>
                <div className="time-stat-card">
                  <h4>Evening Activity</h4>
                  <div className="time-stat-value">{calculateTimeOfDayPercentage(analytics.timeDistribution?.hourlyDistribution, 18, 23)}%</div>
                  <div className="time-stat-label">18:00 - 23:59</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Weekly Activity Chart */}
        <div className="analytics-card day-card">
          <h2>Day of Week Activity</h2>
          <p className="section-description">
            This analysis shows your browsing patterns across different days of the week, revealing when you're most active.
          </p>
          <div className="day-activity-container">
            <div className="day-chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={(analytics.timeDistribution?.dailyDistribution || []).map((count, day) => ({
                    day,
                    count
                  }))}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tickFormatter={formatDay} />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => [`${value} visits`, 'Page Views']}
                    labelFormatter={(day) => `Day: ${formatDay(day)}`}
                  />
                  <Bar dataKey="count" fill="#82ca9d">
                    {(analytics.timeDistribution?.dailyDistribution || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getDayColor(index)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="day-insights">
              <div className="day-insight-card">
                <h3>Weekly Browsing Pattern</h3>
                <div className="day-pattern-summary">
                  <p>{getWeekdayPattern(analytics.timeDistribution?.dailyDistribution)}</p>
                </div>
                <div className="peak-day-info">
                  <h4>Peak Day</h4>
                  <div className="peak-day-display">
                    <div className="peak-day-value">{getPeakDay(analytics.timeDistribution?.dailyDistribution)}</div>
                    <div className="peak-day-percent">{calculatePeakDayPercentage(analytics.timeDistribution?.dailyDistribution)}% of activity</div>
                  </div>
                </div>
              </div>
              <div className="weekday-weekend-summary">
                <div className="day-group-card">
                  <h4>Weekday Activity</h4>
                  <div className="day-group-value">{calculateDayGroupPercentage(analytics.timeDistribution?.dailyDistribution, [1, 2, 3, 4, 5])}%</div>
                  <div className="day-group-label">Monday-Friday</div>
                </div>
                <div className="day-group-card">
                  <h4>Weekend Activity</h4>
                  <div className="day-group-value">{calculateDayGroupPercentage(analytics.timeDistribution?.dailyDistribution, [0, 6])}%</div>
                  <div className="day-group-label">Saturday-Sunday</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Content Types Chart */}
        <div className="analytics-card content-card">
          <h2>Content Consumption Analysis</h2>
          <p className="section-description">
            This analysis shows the types of content you consume online and their relative proportions.
            {analytics.contentTypes?.contentDiversity && 
              ` Your content diversity score is ${analytics.contentTypes.contentDiversity}/100.`}
          </p>
          <div className="chart-container split-view">
            <div className="chart-area">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.contentTypes?.contentTypeDistribution || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="percentage"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {analytics.contentTypes?.contentTypeDistribution?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    )) || []}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name, props) => [`${value.toFixed(1)}%`, 'Percentage']}
                    labelFormatter={(name) => props.payload.type}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="content-details">
              <h3>Content Preferences</h3>
              <div className="primary-content">
                <h4>Primary Content Type</h4>
                <p className="primary-content-type">{analytics.contentTypes?.primaryContentType || 'N/A'}</p>
                <p className="content-insight">
                  {getContentTypeInsight(analytics.contentTypes?.primaryContentType)}
                </p>
              </div>
              <div className="content-type-stats">
                <h4>Detailed Breakdown</h4>
                <ul className="content-type-list">
                  {analytics.contentTypes?.contentTypeDistribution?.map((item, index) => (
                    <li key={index} className="content-type-item">
                      <div className="content-type-color" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <div className="content-type-name">{item.type}</div>
                      <div className="content-type-percent">{item.percentage.toFixed(1)}%</div>
                    </li>
                  )) || <li>No content type data available</li>}
                </ul>
              </div>
            </div>
          </div>
          
          {/* Top Websites Per Content Type */}
          {analytics.contentTypes?.topWebsitesPerType && (
            <div className="top-websites-section">
              <h3>Top Websites By Content Type</h3>
              <div className="top-websites-grid">
                {Object.entries(analytics.contentTypes.topWebsitesPerType)
                  .filter(([_, websites]) => websites.length > 0)
                  .map(([type, websites], typeIndex) => (
                    <div key={typeIndex} className="website-type-card">
                      <h4>{type}</h4>
                      <ul className="website-list">
                        {websites.map((site, siteIndex) => (
                          <li key={siteIndex} className="website-item">
                            <span className="website-domain">{site.domain}</span>
                            <span className="website-count">{site.count} visits</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            </div>
          )}
          
          <div className="content-summary">
            <h3>Content Consumption Summary</h3>
            <p>
              Your content consumption is {getContentDiversitySummary(analytics.contentTypes?.contentTypeDistribution)}.
              {analytics.contentTypes?.contentTypeDistribution?.length > 3 ? 
                ` Your top three content types represent ${getTopContentPercentage(analytics.contentTypes?.contentTypeDistribution)}% of your browsing activity.` : ''}
              {analytics.contentTypes?.contentDiversity && 
                ` Your content diversity score is ${analytics.contentTypes.contentDiversity}/100, indicating ${getContentDiversityDescription(analytics.contentTypes.contentDiversity)}.`}
            </p>
          </div>
        </div>
        
        {/* Behavior Patterns Card */}
        <div className="analytics-card behavior-card">
          <h2>Browsing Behavior & Patterns</h2>
          <p className="section-description">
            This analysis reveals how you interact with websites, including session patterns, returning visits, and time distribution.
          </p>
          
          <div className="behavior-stats">
            <div className="behavior-stat">
              <h3>Average Session</h3>
              <p>{(analytics.behaviorPatterns?.sessionData?.averageDuration || 0).toFixed(1)} minutes</p>
              <div className="stat-comparison">
                {compareToAverage(analytics.behaviorPatterns?.sessionData?.averageDuration, 15, "longer", "shorter")}
              </div>
            </div>
            <div className="behavior-stat">
              <h3>Daily Visits</h3>
              <p>{(analytics.behaviorPatterns?.browsingPatterns?.averageVisitsPerDay || 0).toFixed(1)} pages</p>
              <div className="stat-comparison">
                {compareToAverage(analytics.behaviorPatterns?.browsingPatterns?.averageVisitsPerDay, 25, "more", "fewer")}
              </div>
            </div>
            <div className="behavior-stat">
              <h3>Return Rate</h3>
              <p>{(analytics.behaviorPatterns?.browsingPatterns?.returningVisitRate || 0).toFixed(1)}%</p>
              <div className="stat-comparison">
                {compareToAverage(analytics.behaviorPatterns?.browsingPatterns?.returningVisitRate, 40, "higher", "lower")}
              </div>
            </div>
          </div>
          
          <div className="behavior-detailed-sections">
            <div className="behavior-section">
              <h3>Session Analysis</h3>
              <div className="behavior-insights">
                <div className="behavior-insight-card">
                  <h4>Session Depth</h4>
                  <div className="insight-value">{(analytics.behaviorPatterns?.sessionData?.averageSessionDepth || 0).toFixed(1)} pages</div>
                  <div className="insight-description">Average number of pages viewed in a single browsing session</div>
                </div>
                <div className="behavior-insight-card">
                  <h4>Total Sessions</h4>
                  <div className="insight-value">{analytics.behaviorPatterns?.sessionData?.count || 0}</div>
                  <div className="insight-description">Number of distinct browsing sessions identified</div>
                </div>
              </div>
              <div className="behavior-interpretation">
                {getSessionInsight(analytics.behaviorPatterns?.sessionData)}
              </div>
            </div>
            
            <div className="behavior-section">
              <h3>Returning Visits</h3>
              <div className="returning-sites">
                <h4>Top Revisited Websites</h4>
                <div className="returning-sites-list">
                  {analytics.behaviorPatterns?.browsingPatterns?.topReturningDomains?.map((domain, index) => (
                    <div key={index} className="returning-site-item">
                      <div className="site-rank">{index + 1}</div>
                      <div className="site-domain">{domain.domain}</div>
                      <div className="site-visits">{domain.count} visits</div>
                    </div>
                  )) || <div className="no-data">No returning visit data available</div>}
                </div>
              </div>
            </div>
          </div>
          
          <h3>Weekday vs Weekend Activity</h3>
          <div className="weekday-weekend-container">
            <div className="chart-container weekday-weekend">
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart 
                  cx="50%" 
                  cy="50%" 
                  outerRadius="80%" 
                  data={[
                    { subject: 'Weekday', A: analytics.behaviorPatterns?.browsingPatterns?.weekdayVsWeekend?.weekdayPercentage || 0 },
                    { subject: 'Weekend', A: analytics.behaviorPatterns?.browsingPatterns?.weekdayVsWeekend?.weekendPercentage || 0 }
                  ]}
                >
                  <PolarGrid strokeDasharray="3 3" />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  <Radar name="Usage %" dataKey="A" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="weekday-weekend-insights">
              <div className="weekday-card insight-card">
                <h4>Weekday Activity</h4>
                <div className="weekday-percent">{(analytics.behaviorPatterns?.browsingPatterns?.weekdayVsWeekend?.weekdayPercentage || 0).toFixed(1)}%</div>
                <div className="peak-hour">Peak: {analytics.behaviorPatterns?.browsingPatterns?.weekdayVsWeekend?.weekdayPeakHour || 0}:00</div>
              </div>
              <div className="weekend-card insight-card">
                <h4>Weekend Activity</h4>
                <div className="weekend-percent">{(analytics.behaviorPatterns?.browsingPatterns?.weekdayVsWeekend?.weekendPercentage || 0).toFixed(1)}%</div>
                <div className="peak-hour">Peak: {analytics.behaviorPatterns?.browsingPatterns?.weekdayVsWeekend?.weekendPeakHour || 0}:00</div>
              </div>
            </div>
          </div>
          
          <div className="behavior-summary">
            <h3>Behavior Pattern Summary</h3>
            <p>{getBehaviorSummary(analytics.behaviorPatterns)}</p>
          </div>
        </div>
      </div>
      
      <div className="analytics-summary-text">
        <h2>Analysis Summary</h2>
        <p className="summary-text">{analytics.topicCategories?.summary || "No summary available."}</p>
      </div>
      
      {/* Detailed behavior analysis section */}
      <BehaviorDetailsSection behaviorDetails={analytics.behaviorDetails} />
    </div>
  );
};

export default BrowsingHistoryAnalytics; 