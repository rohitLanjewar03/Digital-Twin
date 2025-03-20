import { useAuth } from "../context/useAuth";
import { useEffect, useState } from "react";

const Dashboard = () => {
    const { user, loading } = useAuth();
    const [emails, setEmails] = useState([]);
    const [replyContent, setReplyContent] = useState("");
    const [replyingTo, setReplyingTo] = useState(null);
    const [tone, setTone] = useState("professional"); // Default tone

    useEffect(() => {
        fetch("http://localhost:5000/email/unseen", { credentials: "include" })
            .then((res) => res.json())
            .then((data) => setEmails(data))
            .catch((err) => console.error("Error fetching emails:", err));
    }, []);

    const handleMarkAsRead = async (emailId) => {
        await fetch(`http://localhost:5000/email/mark-as-read/${emailId}`, {
            method: "POST",
            credentials: "include",
        });
        setEmails(emails.filter((email) => email.id !== emailId));
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
                            <button onClick={() => handleReplyClick(email.id)}>Reply</button>
                            {replyingTo === email.id && (
                                <div>
                                    <select value={tone} onChange={(e) => setTone(e.target.value)}>
                                        <option value="professional">Professional</option>
                                        <option value="casual">Casual</option>
                                        <option value="friendly">Friendly</option>
                                    </select>
                                    <button onClick={() => handleGenerateReply(email.id)}>Generate Reply</button>
                                    <textarea
                                        value={replyContent}
                                        onChange={(e) => setReplyContent(e.target.value)}
                                        placeholder="Type your reply here..."
                                    />
                                    <button onClick={handleSendReply}>Send Reply</button>
                                </div>
                            )}
                        </li>
                    ))
                )}
            </ul>
        </div>
    );
};

export default Dashboard;