import { useAuth } from "../context/useAuth";
import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AIAgent from "./AIAgent";

const Dashboard = () => {
    const { user, loading, logout, validateSession } = useAuth();
    const [emails, setEmails] = useState([]);
    const [replyContent, setReplyContent] = useState("");
    const [replyingTo, setReplyingTo] = useState(null);
    const [tone, setTone] = useState("professional"); // Default tone
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [addingEvent, setAddingEvent] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [lastRefresh, setLastRefresh] = useState(null);
    const refreshIntervalRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        async function fetchData() {
            if (!user) return;

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
            } catch (err) {
                console.error("Error fetching emails:", err);
                setError("Failed to load emails. Please try again later.");
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
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

    // Function to fetch emails
    const fetchEmails = useCallback(async () => {
        if (!user) return;
        
        try {
            setRefreshing(true);
            const response = await fetch("http://localhost:5000/email/unseen", { 
                credentials: "include" 
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    // If unauthorized, logout
                    logout();
                    return;
                }
                throw new Error(`Error: ${response.status}`);
            }
            
            const newEmails = await response.json();
            
            // Check if we have new emails
            if (newEmails.length > emails.length) {
                // If there are more emails than before, check for unique new ones
                const currentIds = emails.map(email => email.id);
                const actualNewEmails = newEmails.filter(email => !currentIds.includes(email.id));
                
                if (actualNewEmails.length > 0) {
                    // We have new emails!
                    showNotification(actualNewEmails.length);
                    
                    // Update email list, merging both lists and avoiding duplicates
                    setEmails(prevEmails => {
                        const allIds = new Set(prevEmails.map(e => e.id));
                        const uniqueNewEmails = newEmails.filter(e => !allIds.has(e.id));
                        return [...prevEmails, ...uniqueNewEmails];
                    });
                } else {
                    // Just update the full list as it might have changed
                    setEmails(newEmails);
                }
            } else {
                // No new emails or fewer emails (some might have been marked as read)
                setEmails(newEmails);
            }
            
            setLastRefresh(new Date());
        } catch (error) {
            console.error("Error fetching emails:", error);
        } finally {
            setRefreshing(false);
        }
    }, [user, emails.length, logout]);

    // Function to show notification
    const showNotification = (count) => {
        // Check if browser supports notifications
        if (!("Notification" in window)) {
            return;
        }
        
        // Check if we already have permission
        if (Notification.permission === "granted") {
            new Notification(`${count} New Email${count > 1 ? 's' : ''}`, {
                body: `You have ${count} new unread email${count > 1 ? 's' : ''}`,
                icon: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico'  // Gmail icon
            });
        } 
        // Ask for permission if not already granted
        else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    new Notification(`${count} New Email${count > 1 ? 's' : ''}`, {
                        body: `You have ${count} new unread email${count > 1 ? 's' : ''}`,
                        icon: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico'
                    });
                }
            });
        }
    };

    // Initial fetch and setup refresh interval
    useEffect(() => {
        if (user) {
            fetchEmails();
            
            // Set up interval to check for new emails (every 30 seconds)
            refreshIntervalRef.current = setInterval(() => {
                fetchEmails();
            }, 30000); // 30 seconds
            
            // Request notification permission on mount
            if ("Notification" in window && Notification.permission === "default") {
                Notification.requestPermission();
            }
        }
        
        // Cleanup: clear interval when component unmounts
        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, [user, fetchEmails]);

    if (loading) return <p>Loading...</p>;
    if (!user) return <p>Please log in to view the dashboard.</p>;

    return (
        <div>
            <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>Welcome, {user.name}!</h2>
                <button 
                    onClick={logout}
                    style={{ 
                        backgroundColor: '#f44336', 
                        color: 'white', 
                        padding: '8px 16px', 
                        border: 'none', 
                        borderRadius: '4px', 
                        cursor: 'pointer' 
                    }}
                >
                    Logout
                </button>
            </div>

            {/* AI Agent Section */}
            <AIAgent />
            
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginTop: '30px',
                marginBottom: '10px'
            }}>
                <h3 style={{ margin: 0 }}>Unseen Emails</h3>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    {lastRefresh && (
                        <span style={{ fontSize: '0.8rem', color: '#666', marginRight: '10px' }}>
                            Last updated: {lastRefresh.toLocaleTimeString()}
                        </span>
                    )}
                    <button 
                        onClick={fetchEmails} 
                        disabled={refreshing}
                        style={{
                            backgroundColor: '#f1f1f1',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '5px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            cursor: refreshing ? 'not-allowed' : 'pointer',
                            opacity: refreshing ? 0.7 : 1
                        }}
                    >
                        {refreshing ? (
                            <>
                                <span className="refresh-icon" style={{
                                    display: 'inline-block',
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    border: '2px solid #ccc',
                                    borderTopColor: '#333',
                                    animation: 'spin 1s linear infinite',
                                    marginRight: '5px'
                                }}></span>
                                Refreshing...
                            </>
                        ) : (
                            'Refresh'
                        )}
                    </button>
                </div>
            </div>

            <style>
                {`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                `}
            </style>
            
            {error && (
                <div style={{ 
                    backgroundColor: '#ffebee', 
                    color: '#c62828', 
                    padding: '10px', 
                    borderRadius: '4px', 
                    marginBottom: '15px' 
                }}>
                    {error}
                </div>
            )}
            
            {isLoading ? (
                <p>Loading emails...</p>
            ) : (
            <ul>
                {emails.length === 0 ? (
                    <p>No unread emails</p>
                ) : (
                    emails.map((email) => (
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
                    )) 
                )}
            </ul>
            )}
        </div>
    );
};

export default Dashboard;