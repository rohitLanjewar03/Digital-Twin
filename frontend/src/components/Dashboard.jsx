import { useAuth } from "../context/useAuth";
import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import AIAgent from "./AIAgent";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/Dashboard.css';
import { useQuery } from '@tanstack/react-query';

const Dashboard = () => {
    const { user, loading } = useAuth();
    const [replyingTo, setReplyingTo] = useState(null);
    const [addingEvent, setAddingEvent] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const navigate = useNavigate();
    const searchInputRef = useRef(null);
    const [summarizing, setSummarizing] = useState(null);
    const [summaryErrors, setSummaryErrors] = useState({});
    const [expandedSummaries, setExpandedSummaries] = useState({});
    const [activeTab, setActiveTab] = useState("inbox");

    // React Query: Emails
    const {
        data: emails,
        isLoading,
        refetch: refetchEmails
    } = useQuery({
        queryKey: ['emails'],
        queryFn: async () => {
            const response = await fetch("http://localhost:5000/email/unseen", { credentials: "include" });
            if (!response.ok) {
                throw new Error(`Error: ${response.status} ${response.statusText}`);
            }
            return response.json();
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const filteredEmails = (emails || []).filter(email => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            email.subject?.toLowerCase().includes(q) ||
            email.from?.toLowerCase().includes(q) ||
            email.snippet?.toLowerCase().includes(q)
        );
    });

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

        } catch (err) {
            console.error("Error marking as read:", err);
        }
    };

    const handleReplyClick = (emailId) => {
        setReplyingTo(emailId);
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
            // Show initial feedback
            toast.info("Analyzing email for event details...", { autoClose: 2000 });
            
            const response = await fetch(`http://localhost:5000/email/add-to-calendar/${emailId}`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || "Failed to add event to calendar");
            }
            
            if (data.success && data.eventDetails) {
                // Show success message with event details
                toast.success(
                    `Event added to calendar: ${data.eventDetails.summary}`,
                    { autoClose: 3000 }
                );
                
                // Use setTimeout to avoid window.confirm blocking toast display
                if (data.eventDetails.htmlLink) {
                    toast.info(
                        "You can view this event in your Google Calendar",
                        { autoClose: 3000 }
                    );
                }
                
            } else if (data.noEventFound) {
                toast.warning("No event details found in this email.", { autoClose: 3000 });
            } else {
                toast.error("Something went wrong when adding the event to your calendar.", { autoClose: 3000 });
            }
        } catch (error) {
            console.error("Error adding event to calendar:", error);
            
            // More user-friendly error messages
            if (error.message.includes("Authentication")) {
                toast.error("Authentication error. Please log out and log in again.", { autoClose: 3000 });
            } else if (error.message.includes("conflict")) {
                toast.error("Calendar conflict detected. Please check your calendar.", { autoClose: 3000 });
            } else {
                toast.error("Error adding event to calendar: " + error.message, { autoClose: 3000 });
            }
        } finally {
            setAddingEvent(false);
        }
    };

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

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
        }
    };

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
        refetchEmails(); // Force refresh
    };

    // Handle sidebar tab selection
    const handleTabSelect = (tab) => {
        setActiveTab(tab);
    };

    if (loading) return <p>Loading...</p>;
    if (!user) return <p>Please log in to view the dashboard.</p>;

    return (
        <div className="dashboard-container">
            <ToastContainer 
                position="top-right" 
                autoClose={3000} 
                hideProgressBar={false} 
                newestOnTop 
                closeOnClick 
                rtl={false} 
                pauseOnFocusLoss={false} 
                draggable 
                pauseOnHover 
                theme="light"
                limit={3}
            />
            
            {/* Sidebar */}
            <div className="sidebar">
                <div 
                    className={`sidebar-option ${activeTab === "inbox" ? "active" : ""}`}
                    onClick={() => handleTabSelect("inbox")}
                >
                    <span className="sidebar-option-icon">📥</span>
                    <span className="sidebar-option-text">Inbox</span>
                    <span className="sidebar-option-count">({filteredEmails.length})</span>
                </div>
                <button
                    className={`sidebar-option compose-btn ${activeTab === "compose" ? "active" : ""}`}
                    onClick={() => handleTabSelect("compose")}
                    style={{
                        background: "var(--accent-color)",
                        color: "var(--button-text)",
                        border: "none",
                        width: "calc(100% - 16px)",
                        margin: "8px",
                        padding: "12px 16px",
                        borderRadius: "16px",
                        fontWeight: 500,
                        cursor: "pointer"
                    }}
                >
                    <span className="sidebar-option-icon">✏️</span>
                    <span className="sidebar-option-text">Compose</span>
                </button>
            </div>
            
            {/* Main Content */}
            <div className="main-content">
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
                        <button type="submit" className="search-button">
                            <span className="micro-interaction">🔍</span> Search
                        </button>
                    </form>
                </div>
                
                {/* Email list - Only show when activeTab is "inbox" */}
                {activeTab === "inbox" && (
                    isLoading ? (
                        <div className="loading">
                            <div className="micro-interaction">📧</div> Loading emails...
                        </div>
                    ) : (
                        <div className="emails-container">
                            {/* Emails header with refresh button */}
                            <div className="emails-header">
                                <h2>
                                    <span className="micro-interaction">📥</span> Inbox ({filteredEmails.length})
                                </h2>
                                <div className="refresh-container">
                                    <button
                                        className={`refresh-button ${refreshing ? 'refreshing' : ''}`}
                                        onClick={handleRefresh}
                                    >
                                        <span className="micro-interaction">🔄</span>
                                    </button>
                                </div>
                            </div>
                            
                            {/* Emails list */}
                            {filteredEmails.length === 0 ? (
                                <div className="no-emails">
                                    <span className="micro-interaction">📭</span> {searchQuery ? "No emails match your search." : "No new emails."}
                                </div>
                            ) : (
                                <ul className="emails-list">
                                    {filteredEmails.map((email) => (
                                        <li key={email.id} className="email-item animate-fade">
                                            <div className="email-header">
                                                <div className="email-from">
                                                    <span className="micro-interaction">👤</span> {email.from}
                                                    {isNoReplyEmail(email.from) && (
                                                        <span className="no-reply-badge">
                                                            <span className="micro-interaction">🤖</span> No-Reply
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className="email-subject">
                                                <span className="micro-interaction">📝</span> {email.subject}
                                            </div>
                                            
                                            <div className="email-preview">
                                                {getEmailContent(email).preview}
                                            </div>
                                            
                                            {getEmailContent(email).aiSummary ? (
                                                <div className="email-summary">
                                                    <button
                                                        onClick={() => toggleSummary(email.id)}
                                                        className="summary-toggle"
                                                    >
                                                        <span className="micro-interaction">
                                                            {expandedSummaries[email.id] ? '📕' : '📖'}
                                                        </span>
                                                        {expandedSummaries[email.id] ? 'Hide AI Summary' : 'Show AI Summary'}
                                                    </button>
                                                    
                                                    {expandedSummaries[email.id] && (
                                                        <div className="summary-content animate-slide">
                                                            <span className="micro-interaction">🤖</span> <strong>AI Summary:</strong> {getEmailContent(email).aiSummary}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="email-summary">
                                                    <button
                                                        onClick={() => requestEmailSummary(email.id)}
                                                        disabled={summarizing === email.id}
                                                        className="summary-generate"
                                                    >
                                                        <span className="micro-interaction">
                                                            {summarizing === email.id ? '⏳' : '🤖'}
                                                        </span>
                                                        {summarizing === email.id ? 'Generating...' : 'Generate AI Summary'}
                                                    </button>
                                                    {summaryErrors[email.id] && (
                                                        <div className="summary-error">
                                                            <span className="micro-interaction">⚠️</span> {summaryErrors[email.id]}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            
                                            <div className="email-actions">
                                                <button 
                                                    onClick={() => handleMarkAsRead(email.id)}
                                                    className="email-action-btn btn-read"
                                                >
                                                    <span className="micro-interaction">✓</span> Mark as Read
                                                </button>
                                                
                                                {!isNoReplyEmail(email.from) ? (
                                                    <button 
                                                        onClick={() => handleReplyClick(email.id)}
                                                        className="email-action-btn btn-reply"
                                                        disabled={replyingTo === email.id}
                                                    >
                                                        <span className="micro-interaction">↩️</span> Reply
                                                    </button>
                                                ) : (
                                                    <button 
                                                        disabled 
                                                        title="Cannot reply to no-reply addresses"
                                                        className="email-action-btn btn-reply btn-disabled"
                                                    >
                                                        <span className="micro-interaction">↩️</span> Reply
                                                    </button>
                                                )}
                                                
                                                {likelyContainsEventInfo(email) && (
                                                    <button 
                                                        onClick={() => handleAddToCalendar(email.id)}
                                                        disabled={addingEvent}
                                                        className="email-action-btn btn-calendar"
                                                    >
                                                        <span className="micro-interaction">📅</span> {addingEvent ? 'Adding...' : 'Add to Calendar'}
                                                    </button>
                                                )}
                                                
                                                <button
                                                    onClick={() => window.open(`https://mail.google.com/mail/u/0/#inbox/${email.id}`, '_blank')}
                                                    className="email-action-btn btn-view"
                                                >
                                                    <span className="micro-interaction">👁️</span> View in Gmail
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )
                )}
                {/* Compose section */}
                {activeTab === "compose" && (
                  <div className="compose-container">
                    <h2><span className="micro-interaction">✏️</span> Compose New Email</h2>
                    <AIAgent />
                  </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;