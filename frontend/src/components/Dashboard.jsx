import { useAuth } from "../context/useAuth";
import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import AIAgent from "./AIAgent";

const Dashboard = () => {
    const { user, loading, logout, validateSession } = useAuth();
    const [emails, setEmails] = useState([]);
    const [filteredEmails, setFilteredEmails] = useState([]);
    const [replyContent, setReplyContent] = useState("");
    const [replyingTo, setReplyingTo] = useState(null);
    const [tone, setTone] = useState("professional"); // Default tone
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [addingEvent, setAddingEvent] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [lastRefresh, setLastRefresh] = useState(null);
    const refreshIntervalRef = useRef(null);
    const [searchQuery, setSearchQuery] = useState("");
    const navigate = useNavigate();
    const [newsArticles, setNewsArticles] = useState([]);
    const [showNews, setShowNews] = useState(false);
    const [newsLoading, setNewsLoading] = useState(false);
    const [newsError, setNewsError] = useState(null);
    const NEWS_API_KEY = import.meta.env.VITE_NEWS_API_KEY;
    const searchInputRef = useRef(null);

    // Function to fetch emails
    const fetchData = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Validate session first
            const isValid = await validateSession();
            if (!isValid) {
                // If session is invalid, navigate to login
                navigate("/");
                return;
            }

            // Fetch emails
            const response = await fetch("http://localhost:5000/email/unseen", { 
                credentials: "include" 
            });

            if (response.status === 401) {
                // If unauthorized, logout
                logout();
                return;
            }

            if (!response.ok) {
                throw new Error(`Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            setEmails(data);
            // Also update filtered emails
            if (searchQuery.trim() === "") {
                setFilteredEmails(data);
            }
            
            // Update last refresh time
            setLastRefresh(new Date());
        } catch (err) {
            console.error("Error fetching emails:", err);
            setError("Failed to load emails. Please try again later.");
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    // Function to fetch news based on search query
    const fetchNews = async (query) => {
        if (!query) return;
        
        setNewsLoading(true);
        setNewsError(null);
        
        try {
            // Get today's date and format it
            const today = new Date();
            const formattedDate = today.toISOString().split('T')[0];
            
            // Use the News API to fetch articles related to the search query
            const response = await fetch(
                `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&from=${formattedDate}&sortBy=popularity&apiKey=${NEWS_API_KEY}`
            );
            
            if (!response.ok) {
                throw new Error(`News API Error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.status === 'ok' && data.articles && data.articles.length > 0) {
                // Limit to top 5 articles
                setNewsArticles(data.articles.slice(0, 5));
                setShowNews(true);
            } else {
                setNewsArticles([]);
                setNewsError("No news articles found for this search query.");
            }
        } catch (err) {
            console.error("Error fetching news:", err);
            setNewsError(`Failed to load news: ${err.message}`);
        } finally {
            setNewsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        
        // Start refresh interval
        refreshIntervalRef.current = setInterval(() => {
            fetchData();
        }, 30000); // Refresh every 30 seconds
        
        // Cleanup interval on unmount
        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, [user, navigate, logout, validateSession]);

    // Function to check if an email is from a no-reply address
    const isNoReplyEmail = (fromAddress) => {
        if (!fromAddress) return false;
        
        // Convert to lowercase for case-insensitive matching
        const lowerCaseFrom = fromAddress.toLowerCase();
        
        // Check for common no-reply patterns
        const noReplyPatterns = [
            'noreply@',
            'no-reply@',
            'donotreply@',
            'do-not-reply@',
            'no.reply@',
            'noreply-',
            'automated',
            'notification@',
            'notifications@',
            'alert@',
            'alerts@',
            'system@',
            'mailer@',
            'mailbot@',
            'bounce@'
        ];
        
        // Check if the email contains any of the no-reply patterns
        return noReplyPatterns.some(pattern => lowerCaseFrom.includes(pattern));
    };

    const handleMarkAsRead = async (emailId) => {
        try {
            const response = await fetch(`http://localhost:5000/email/mark-as-read/${emailId}`, {
            method: "POST",
            credentials: "include",
        });

            if (response.status === 401) {
                localStorage.removeItem("user");
                navigate("/");
                return;
            }

        setEmails(emails.filter((email) => email.id !== emailId));
        } catch (err) {
            console.error("Error marking as read:", err);
        }
    };

    const handleReplyClick = (emailId) => {
        setReplyingTo(emailId);
    };

    const handleGenerateReply = async (emailId) => {
        try {
            const response = await fetch(`http://localhost:5000/email/generate-reply/${emailId}`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ tone, userName: user.name }), // Send the selected tone
            });

            if (!response.ok) {
                throw new Error("Failed to generate reply");
            }

            const data = await response.json();
            setReplyContent(data.reply); // Set the generated reply in the textarea
        } catch (error) {
            console.error("Error generating reply:", error);
        }
    };

    const handleSendReply = async () => {
        if (!replyingTo || !replyContent) return;

        try {
            const response = await fetch(`http://localhost:5000/email/send-reply/${replyingTo}`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ replyContent }),
            });

            if (!response.ok) {
                throw new Error("Failed to send reply");
            }

            const data = await response.json();
            alert(data.message); // Show success message
            setReplyingTo(null); // Close the reply form
            setReplyContent(""); // Clear the reply content
        } catch (error) {
            console.error("Error sending reply:", error);
            alert("Failed to send reply");
        }
    };

    // Function to check if an email likely contains event information
    const likelyContainsEventInfo = (email) => {
        if (!email) return false;
        
        // Combined content to analyze
        const combinedContent = `${email.subject || ''} ${email.summary || ''}`.toLowerCase();
        
        // Keywords related to events, meetings, appointments
        const eventKeywords = [
            'meeting', 'appointment', 'schedule', 'calendar', 'event', 
            'invite', 'invitation', 'webinar', 'conference', 'seminar',
            'workshop', 'session', 'call', 'zoom', 'teams', 'google meet',
            'interview', 'reservation', 'booking', 'reminder',
            'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
            'january', 'february', 'march', 'april', 'may', 'june', 
            'july', 'august', 'september', 'october', 'november', 'december'
        ];
        
        // Time-related patterns
        const timePatterns = [
            /\d{1,2}:\d{2}/, // HH:MM
            /\d{1,2}(am|pm|AM|PM)/, // HAM/PM
            /\d{1,2}\s*(am|pm|AM|PM)/, // H AM/PM
            /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/, // Date patterns (MM/DD/YYYY)
            /\d{1,2}(st|nd|rd|th)/, // 1st, 2nd, 3rd, etc.
            /next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, // next day
            /tomorrow/i,
            /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i, // Month abbreviations
        ];
        
        // Check for event keywords
        const hasEventKeyword = eventKeywords.some(keyword => combinedContent.includes(keyword));
        
        // Check for time patterns
        const hasTimePattern = timePatterns.some(pattern => pattern.test(combinedContent));
        
        // Look for event-related phrases
        const hasEventPhrase = /join us|save the date|mark your calendar|rsvp|you('re| are) invited|reschedule|scheduled for/i.test(combinedContent);
        
        // Return true if the email likely contains event information
        return hasEventKeyword && (hasTimePattern || hasEventPhrase);
    };

    const handleAddToCalendar = async (emailId) => {
        setAddingEvent(true);
        try {
            const response = await fetch(`http://localhost:5000/email/add-to-calendar/${emailId}`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error("Failed to add event to calendar");
            }

            const data = await response.json();
            
            if (data.success) {
                alert(`Event added to your calendar: ${data.eventDetails.summary}`);
            } else if (data.noEventFound) {
                alert("No event details found in this email.");
            } else {
                alert("Something went wrong when adding the event to your calendar.");
            }
        } catch (error) {
            console.error("Error adding event to calendar:", error);
            alert("Error adding event to calendar: " + error.message);
        } finally {
            setAddingEvent(false);
        }
    };

    // Handler for search input changes
    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
        
        // Filter emails as user types
        if (e.target.value.trim() === "") {
            setFilteredEmails(emails);
        } else {
            const lowercaseQuery = e.target.value.toLowerCase();
            const filtered = emails.filter(email => 
                email.subject?.toLowerCase().includes(lowercaseQuery) ||
                email.from?.toLowerCase().includes(lowercaseQuery) ||
                email.snippet?.toLowerCase().includes(lowercaseQuery)
            );
            setFilteredEmails(filtered);
        }
    };

    // Handler for search submission
    const handleSearchSubmit = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            // Filter emails
            const lowercaseQuery = searchQuery.toLowerCase();
            const filtered = emails.filter(email => 
                email.subject?.toLowerCase().includes(lowercaseQuery) ||
                email.from?.toLowerCase().includes(lowercaseQuery) ||
                email.snippet?.toLowerCase().includes(lowercaseQuery)
            );
            setFilteredEmails(filtered);
            
            // Fetch news related to the search query
            fetchNews(searchQuery);
        } else {
            setFilteredEmails(emails);
            setShowNews(false);
        }
    };

    // Toggle news display
    const toggleNews = () => {
        setShowNews(!showNews);
    };

    // Update email filtering when emails change
    useEffect(() => {
        if (searchQuery.trim() === "") {
            setFilteredEmails(emails);
        } else {
            const lowercaseQuery = searchQuery.toLowerCase();
            const filtered = emails.filter(email => 
                email.subject?.toLowerCase().includes(lowercaseQuery) ||
                email.from?.toLowerCase().includes(lowercaseQuery) ||
                email.snippet?.toLowerCase().includes(lowercaseQuery)
            );
            setFilteredEmails(filtered);
        }
    }, [emails, searchQuery]);

    // Render news articles section
    const renderNewsArticles = () => {
        if (newsLoading) {
            return <div className="news-loading">Loading related news...</div>;
        }
        
        if (newsError) {
            return <div className="news-error">{newsError}</div>;
        }
        
        if (newsArticles.length === 0) {
            return <div className="no-news">No related news articles found.</div>;
        }
        
        return (
            <div className="news-articles">
                <h3>Related News for "{searchQuery}"</h3>
                <ul className="news-list">
                    {newsArticles.map((article, index) => (
                        <li key={index} className="news-item">
                            {article.urlToImage && (
                                <img 
                                    src={article.urlToImage} 
                                    alt={article.title} 
                                    className="news-image"
                                />
                            )}
                            <div className="news-content">
                                <h4 className="news-title">
                                    <a href={article.url} target="_blank" rel="noopener noreferrer">
                                        {article.title}
                                    </a>
                                </h4>
                                <p className="news-description">{article.description}</p>
                                <div className="news-meta">
                                    <span className="news-source">{article.source.name}</span>
                                    <span className="news-date">
                                        {new Date(article.publishedAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    if (loading) return <p>Loading...</p>;
    if (!user) return <p>Please log in to view the dashboard.</p>;

    return (
        <div className="dashboard-container">
            <header>
                <h1>Digital Twin Dashboard</h1>
                <div className="header-buttons">
                    <Link to="/news" className="news-button">
                        News Feed
                    </Link>
                    <button onClick={logout} className="logout-button">
                        Logout
                    </button>
                </div>
            </header>
            
            {/* Search bar */}
            <div className="search-container">
                <form onSubmit={handleSearchSubmit}>
                    <input 
                        type="text"
                        placeholder="Search emails..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        className="search-input"
                        ref={searchInputRef}
                    />
                    <button type="submit" className="search-button">Search</button>
                </form>
            </div>
            
            {/* News Section */}
            {newsArticles.length > 0 && (
                <div className="news-container">
                    <button className="toggle-news-btn" onClick={toggleNews}>
                        {showNews ? "Hide News" : "Show Related News"}
                    </button>
                    {showNews && renderNewsArticles()}
                </div>
            )}
            
            {/* AI Agent Section */}
            <AIAgent />
            
            {/* Rest of your component UI */}
            {error && <div className="error-message">{error}</div>}
            
            {isLoading ? (
                <div className="loading">Loading emails...</div>
            ) : (
                <div className="emails-container">
                    {/* Emails header with refresh button */}
                    <div className="emails-header">
                        <h2>Inbox ({filteredEmails.length})</h2>
                        <div className="refresh-container">
                            {lastRefresh && (
                                <span className="last-refresh">
                                    Last updated: {lastRefresh.toLocaleTimeString()}
                                </span>
                            )}
                            <button 
                                className={`refresh-button ${refreshing ? 'refreshing' : ''}`}
                                onClick={() => {
                                    setRefreshing(true);
                                    fetchData();
                                }}
                            >
                                Refresh
                            </button>
                        </div>
                    </div>
                    
                    {/* Emails list */}
                    {filteredEmails.length === 0 ? (
                        <div className="no-emails">
                            {searchQuery ? "No emails match your search." : "No new emails."}
                        </div>
                    ) : (
                        <div className="emails-list">
                            {filteredEmails.map((email) => (
                                <li key={email.id} style={{ 
                                    marginBottom: '15px', 
                                    padding: '15px', 
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    backgroundColor: isNoReplyEmail(email.from) ? 'blue' : 'red'
                                }}>
                                    <strong>From:</strong> {email.from}
                                    {isNoReplyEmail(email.from) && (
                                        <span style={{ 
                                            marginLeft: '10px', 
                                            backgroundColor: '#ffeb3b', 
                                            padding: '3px 6px', 
                                            borderRadius: '3px',
                                            fontSize: '0.8rem',
                                            color: '#333'
                                        }}>
                                            No-Reply Address
                                        </span>
                                    )}
                                    <br />
                            <strong>Subject:</strong> {email.subject}<br />
                            <strong>Summary:</strong> {email.summary}<br />
                                    <div style={{ marginTop: '10px' }}>
                                        <button 
                                            onClick={() => handleMarkAsRead(email.id)}
                                            style={{ marginRight: '5px' }}
                                        >
                                            Mark as Read
                                        </button>
                                        {!isNoReplyEmail(email.from) ? (
                                            <button 
                                                onClick={() => handleReplyClick(email.id)}
                                                style={{ marginRight: '5px' }}
                                            >
                                                Reply
                                            </button>
                                        ) : (
                                            <button 
                                                disabled 
                                                title="Cannot reply to no-reply addresses"
                                                style={{ 
                                                    opacity: 0.5, 
                                                    cursor: 'not-allowed',
                                                    marginRight: '5px'
                                                }}
                                            >
                                                Reply
                                            </button>
                                        )}
                                        {/* Only show Add to Calendar button if the email likely contains event info */}
                                        {likelyContainsEventInfo(email) && (
                                            <button 
                                                onClick={() => handleAddToCalendar(email.id)}
                                                disabled={addingEvent}
                                                style={{
                                                    backgroundColor: '#4285F4',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '5px 10px',
                                                    borderRadius: '4px',
                                                    cursor: addingEvent ? 'not-allowed' : 'pointer',
                                                    opacity: addingEvent ? 0.7 : 1,
                                                    marginRight: '5px'
                                                }}
                                            >
                                                {addingEvent ? 'Adding...' : 'Add to Calendar'}
                                            </button>
                                        )}
                            {replyingTo === email.id && (
                                        <div style={{ marginTop: '10px' }}>
                                            <select 
                                                value={tone} 
                                                onChange={(e) => setTone(e.target.value)}
                                                style={{ marginRight: '5px' }}
                                            >
                                        <option value="professional">Professional</option>
                                        <option value="casual">Casual</option>
                                        <option value="friendly">Friendly</option>
                                    </select>
                                            <button 
                                                onClick={() => handleGenerateReply(email.id)}
                                                style={{ marginRight: '5px' }}
                                            >
                                                Generate Reply
                                            </button>
                                    <textarea
                                        value={replyContent}
                                        onChange={(e) => setReplyContent(e.target.value)}
                                        placeholder="Type your reply here..."
                                                style={{ 
                                                    display: 'block', 
                                                    width: '100%', 
                                                    marginTop: '10px',
                                                    minHeight: '100px',
                                                    padding: '8px',
                                                    borderRadius: '4px',
                                                    border: '1px solid #ddd'
                                                }}
                                            />
                                            <button 
                                                onClick={handleSendReply}
                                                style={{ 
                                                    marginTop: '10px',
                                                    backgroundColor: '#4caf50',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '8px 16px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Send Reply
                                            </button>
                                </div>
                            )}
                                    </div>
                        </li>
                            ))}
                        </div>
                    )}
                </div>
                )}
        </div>
    );
};

export default Dashboard;