import { useAuth } from "../context/useAuth";
import { useEffect, useState } from "react";

const Dashboard = () => {
    const { user, loading } = useAuth();
    const [emails, setEmails] = useState([]);

    useEffect(() => {
        fetch("http://localhost:5000/email/unseen", { credentials: "include" })
            .then(res => res.json())
            .then(data => setEmails(data))
            .catch(err => console.error("Error fetching emails:", err));
    }, []);

    if (loading) {
        return <p>Loading...</p>; // Show loading indicator
    }

    if (!user) {
        return <p>Please log in to view the dashboard.</p>; // Fallback for unauthenticated users
    }
    

    return (
        <>
            <div>
                <h2>Welcome, {user.name}!</h2>
                <p>Email: {user.email}</p>
            </div>
            <div>
            <h2>Unseen Emails</h2>
            <ul>
                {emails.length === 0 ? (
                    <p>No unread emails</p>
                ) : (
                    emails.map((email) => (
                        <li key={email.id}>
                            <strong>{email.from}</strong>: {email.subject}
                        </li>
                    ))
                )}
            </ul>
        </div>
        </>
    );
};

export default Dashboard;