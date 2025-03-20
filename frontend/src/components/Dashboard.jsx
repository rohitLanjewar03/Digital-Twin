import { useAuth } from "../context/useAuth";
import { useEffect, useState } from "react";

const Dashboard = () => {
    const { user, loading } = useAuth();
    const [emails, setEmails] = useState([]);


    // Fetch unseen emails
    useEffect(() => {
        fetch("http://localhost:5000/email/unseen", { credentials: "include" })
            .then((res) => res.json())
            .then((data) => setEmails(data))
            .catch((err) => console.error("Error fetching emails:", err));
    }, []);

    // Mark email as read
    const handleMarkAsRead = async (emailId) => {
        try {
            const response = await fetch(`http://localhost:5000/email/mark-as-read/${emailId}`, {
                method: "POST",
                credentials: "include",
            });
            const data = await response.json();
    
            if (response.ok) {
                // Only remove the email from the state if the backend confirms it's marked as read
                setEmails(emails.filter((email) => email.id !== emailId));
            } else {
                console.error("Failed to mark email as read:", data.message);
            }
        } catch (error) {
            console.error("Error marking email as read:", error);
        }
    };

    // Generate a reply
    const handleGenerateReply = async (emailId, tone = "professional") => {
        try {
            const response = await fetch("http://localhost:5000/email/generate-reply", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ emailId, tone }),
            });
            const data = await response.json();
            alert(`Generated Reply:\n\n${data.reply}`);
        } catch (error) {
            console.error("Error generating reply:", error);
        }
    };

    if (loading) return <p>Loading...</p>;
    if (!user) return <p>Please log in to view the dashboard.</p>;

    return (
        <div>
            <h2>Welcome, {user.name}!</h2>
            <h3>Unseen Emails</h3>
            <ul>
                {emails.length === 0 ? (
                    <p>No unread emails</p>
                ) : (
                    emails.map((email) => (
                        <li key={email.id}>
                            <strong>From:</strong> {email.from}<br />
                            <strong>Subject:</strong> {email.subject}<br />
                            <strong>Summary:</strong> {email.summary}<br />
                            <button onClick={() => handleMarkAsRead(email.id)}>Mark as Read</button>
                            <button onClick={() => handleGenerateReply(email.id, "professional")}>
                                Generate Reply
                            </button>
                        </li>
                    ))
                )}
            </ul>
        </div>
    );
};

export default Dashboard;