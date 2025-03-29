import { useAuth } from "../context/useAuth";
import { useEffect, useState, useRef, useCallback } from "react";
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
    const searchInputRef = useRef(null);
    const [summarizing, setSummarizing] = useState(null);
    const [summaryErrors, setSummaryErrors] = useState({});
    const [expandedSummaries, setExpandedSummaries] = useState({});

    // Function to fetch emails
    const fetchData = useCallback(async (forceRefresh = false) => {
        // If not forcing refresh and we have cached data, use it
        const cachedEmails = localStorage.getItem('cachedEmails');
        const cachedTimestamp = localStorage.getItem('emailsCachedAt');
        const now = new Date().getTime();
        
        // Use cache if: not forcing refresh, cache exists, and cache is less than 5 minutes old
        if (!forceRefresh && 
            cachedEmails && 
            cachedTimestamp && 
            (now - parseInt(cachedTimestamp) < 5 * 60 * 1000)) {
            try {
                const parsedEmails = JSON.parse(cachedEmails);
                setEmails(parsedEmails);
                if (searchQuery.trim() === "") {
                    setFilteredEmails(parsedEmails);
                }
                setLastRefresh(new Date(parseInt(cachedTimestamp)));
                setIsLoading(false);
                return;
            } catch (err) {
                console.error("Error parsing cached emails:", err);
                // Continue with API fetch if cache parsing fails
            }
        }
        
        // If we're forcing refresh or cache is invalid, fetch from API
        if (forceRefresh) {
            setRefreshing(true);
        } else {
            setIsLoading(true);
        }
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
            
            // Cache the emails in localStorage
            localStorage.setItem('cachedEmails', JSON.stringify(data));
            localStorage.setItem('emailsCachedAt', now.toString());
            
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
    }, [searchQuery, navigate, logout, validateSession]);

    useEffect(() => {
        // Only fetch on mount, not when dependencies change
        const shouldFetch = !localStorage.getItem('cachedEmails');
        if (shouldFetch) {
            fetchData(false);
        } else {
            // Use cached data
            fetchData(false);
        }
        
        // Cleanup function (keep this part)
        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, []); // Empty dependency array - only run on mount

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

    const getEmailContent = (email) => {
        // Get the best available preview content
        let previewContent = '';
        
        // Use snippet if available
        if (email.snippet && email.snippet.trim() !== '') {
            previewContent = email.snippet;
        }
        // Try bodyPreview if no snippet or snippet is empty
        else if (email.bodyPreview && email.bodyPreview.trim() !== '') {
            previewContent = email.bodyPreview;
        }
        // Use body text if available, trim to reasonable length
        else if (email.body && typeof email.body === 'string') {
            // Remove any HTML tags
            const textOnly = email.body.replace(/<[^>]*>/g, ' ');
            // Trim to 150 characters
            previewContent = textOnly.substring(0, 150) + (textOnly.length > 150 ? '...' : '');
        }
        else {
            previewContent = 'Email preview not available. Please check the email directly.';
        }
        
        // Check if AI summary is available and valid
        const hasAiSummary = email.summary && !email.summary.includes('API quota exceeded');
        
        return {
            preview: previewContent,
            aiSummary: hasAiSummary ? email.summary : null
        };
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
        } else {
            setFilteredEmails(emails);
        }
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

    // Add this new function to request a summary for a specific email
    const requestEmailSummary = async (emailId) => {
        if (summarizing === emailId) return; // Prevent duplicate requests
        
        setSummarizing(emailId);
        setSummaryErrors(prev => ({ ...prev, [emailId]: null }));
        
        try {
            const response = await fetch(`http://localhost:5000/email/summarize/${emailId}`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to generate summary: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Update the email with the new summary
            setEmails(prevEmails => 
                prevEmails.map(email => 
                    email.id === emailId ? { ...email, summary: data.summary } : email
                )
            );
        } catch (error) {
            console.error("Error generating summary:", error);
            setSummaryErrors(prev => ({ 
                ...prev, 
                [emailId]: "Failed to generate summary. API quota may still be exceeded."
            }));
        } finally {
            setSummarizing(null);
        }
    };

    // Add a function to toggle summary expansion
    const toggleSummary = (emailId) => {
        setExpandedSummaries(prev => ({
            ...prev,
            [emailId]: !prev[emailId]
        }));
    };

    // Update the refresh button click handler
    const handleRefresh = () => {
        setRefreshing(true);
        fetchData(true); // Force refresh
    };

    if (loading) return <p>Loading...</p>;
    if (!user) return <p>Please log in to view the dashboard.</p>;

    return (
        <div className="dashboard-container">
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
                                onClick={handleRefresh}
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
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '4px',
                                    backgroundColor: 'var(--card-bg)'
                                }}>
                                    <strong>From:</strong> {email.from}
                                    {isNoReplyEmail(email.from) && (
                                        <span style={{ 
                                            marginLeft: '10px', 
                                            backgroundColor: 'var(--warning-color)', 
                                            padding: '3px 6px', 
                                            borderRadius: '3px',
                                            fontSize: '0.8rem',
                                            color: 'var(--bg-primary)'
                                        }}>
                                            No-Reply Address
                                        </span>
                                    )}
                                    <br />
                            <strong>Subject:</strong> {email.subject}<br />
                            <strong>Preview:</strong> {getEmailContent(email).preview}<br />
                            
                            {getEmailContent(email).aiSummary ? (
                                <div style={{ marginTop: '5px' }}>
                                    <button
                                        onClick={() => toggleSummary(email.id)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            textDecoration: 'underline',
                                            cursor: 'pointer',
                                            color: 'black',
                                            fontSize: '0.9rem',
                                            padding: '0',
                                            display: 'inline-flex',
                                            alignItems: 'center'
                                        }}
                                    >
                                        {expandedSummaries[email.id] ? 'Hide AI Summary' : 'Show AI Summary'}
                                    </button>
                                    
                                    {expandedSummaries[email.id] && (
                                        <div style={{ 
                                            margin: '8px 0',
                                            padding: '8px 12px',
                                            background: 'var(--bg-secondary)',
                                            borderLeft: '3px solid var(--accent-color)',
                                            borderRadius: '2px'
                                        }}>
                                            <strong>AI Summary:</strong> {getEmailContent(email).aiSummary}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ marginTop: '5px' }}>
                                    <button
                                        onClick={() => requestEmailSummary(email.id)}
                                        disabled={summarizing === email.id}
                                        style={{
                                            fontSize: '0.9rem',
                                            padding: '2px 8px',
                                            backgroundColor: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '3px',
                                            cursor: summarizing === email.id ? 'wait' : 'pointer'
                                        }}
                                    >
                                        {summarizing === email.id ? 'Generating...' : 'Generate AI Summary'}
                                    </button>
                                    {summaryErrors[email.id] && (
                                        <div style={{ 
                                            color: 'red', 
                                            fontSize: '0.8rem', 
                                            marginTop: '4px' 
                                        }}>
                                            {summaryErrors[email.id]}
                                        </div>
                                    )}
                                </div>
                            )}
                            
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
                                                    backgroundColor: 'var(--accent-color)',
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
                                        <button
                                            onClick={() => window.open(`https://mail.google.com/mail/u/0/#inbox/${email.id}`, '_blank')}
                                            style={{
                                                backgroundColor: 'var(--error-color)',
                                                color: 'white',
                                                border: 'none',
                                                padding: '5px 10px',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                marginRight: '5px'
                                            }}
                                        >
                                            View in Gmail
                                        </button>
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
                                                    border: '1px solid var(--border-color)'
                                                }}
                                            />
                                            <button 
                                                onClick={handleSendReply}
                                                style={{ 
                                                    marginTop: '10px',
                                                    backgroundColor: 'var(--success-color)',
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