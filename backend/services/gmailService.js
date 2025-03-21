const { google } = require("googleapis");
const { summarizeEmail } = require("./geminiService");

async function getUnseenEmails(user) {
    try {
        if (!user || !user.accessToken) {
            throw new Error("User not authenticated");
        }

        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        // Set credentials
        auth.setCredentials({
            access_token: user.accessToken,
            refresh_token: user.refreshToken,
            expiry_date: user.tokenExpiry,
        });

        // Refresh token if expired
        if (auth.isTokenExpiring()) {
            const { tokens } = await auth.refreshAccessToken();
            auth.setCredentials(tokens);

            // Update the user's tokens in the database
            user.accessToken = tokens.access_token;
            user.refreshToken = tokens.refresh_token || user.refreshToken;
            user.tokenExpiry = tokens.expiry_date;
            await user.save();
        }

        const gmail = google.gmail({ version: "v1", auth });

        // Search for unread emails
        const response = await gmail.users.messages.list({
            userId: "me",
            q: "is:unread",
            maxResults: 10,
        });

        const messages = response.data.messages || [];

        // Fetch email details and summarize
        const emails = await Promise.all(
            messages.map(async (msg) => {
                const email = await gmail.users.messages.get({
                    userId: "me",
                    id: msg.id,
                    format: "full",
                });

                const headers = email.data.payload.headers;
                const subject = headers.find((h) => h.name === "Subject")?.value;
                const from = headers.find((h) => h.name === "From")?.value;
                const body = email.data.snippet; // Use snippet or decode full body

                // Summarize email content
                const summary = await summarizeEmail(body);

                return { id: msg.id, from, subject, body, summary };
            })
        );

        return emails;
    } catch (error) {
        console.error("Error fetching unseen emails:", error);
        return [];
    }
}

async function getEmailById(user, emailId) {
    try {
        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        // Set credentials
        auth.setCredentials({
            access_token: user.accessToken,
            refresh_token: user.refreshToken,
            expiry_date: user.tokenExpiry,
        });

        const gmail = google.gmail({ version: "v1", auth });

        // Fetch email by ID
        const email = await gmail.users.messages.get({
            userId: "me",
            id: emailId,
            format: "full", // Fetch full email content
        });

        // Extract email body and headers
        const headers = email.data.payload.headers;
        const subject = headers.find((h) => h.name === "Subject")?.value;
        const from = headers.find((h) => h.name === "From")?.value;
        const body = email.data.snippet; // Use snippet or decode full body

        return { id: emailId, from, subject, body };
    } catch (error) {
        console.error("Error fetching email by ID:", error);
        throw error;
    }
}


async function markEmailAsRead(user, emailId) {
    try {
        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        // Set credentials
        auth.setCredentials({
            access_token: user.accessToken,
            refresh_token: user.refreshToken,
            expiry_date: user.tokenExpiry,
        });

        const gmail = google.gmail({ version: "v1", auth });

        // Mark email as read by removing the UNREAD label
        const response = await gmail.users.messages.modify({
            userId: "me",
            id: emailId,
            requestBody: {
                removeLabelIds: ["UNREAD"], // Remove the UNREAD label
            },
        });

        console.log("Email marked as read:", response.data); // Debugging
        return true;
    } catch (error) {
        console.error("Error marking email as read:", error);
        return false;
    }
}

async function sendReply(user, emailId, replyContent) {
    try {
        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        // Set credentials
        auth.setCredentials({
            access_token: user.accessToken,
            refresh_token: user.refreshToken,
            expiry_date: user.tokenExpiry,
        });

        const gmail = google.gmail({ version: "v1", auth });

        // Fetch the original email to get the "From" and "Subject" fields
        const email = await gmail.users.messages.get({
            userId: "me",
            id: emailId,
            format: "metadata",
            metadataHeaders: ["From", "Subject","Message-ID"],
        });

        const from = email.data.payload.headers.find((h) => h.name === "From")?.value;
        const subject = email.data.payload.headers.find((h) => h.name === "Subject")?.value;
        const messageId = email.data.payload.headers.find((h) => h.name === "Message-ID")?.value;
        // Create the reply message
        const replyMessage = [
            `From: ${user.email}`,
            `To: ${from}`,
            `Subject: ${subject}`,
            `In-Reply-To: ${messageId}`, // Reference the original email
            `References: ${messageId}`, // Reference the original email
            "Content-Type: text/plain; charset=utf-8",
            "MIME-Version: 1.0",
            "",
            replyContent,
        ].join("\n");

        // Encode the message in base64
        const encodedMessage = Buffer.from(replyMessage)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

        // Send the reply
        const response = await gmail.users.messages.send({
            userId: "me",
            requestBody: {
                raw: encodedMessage,
            },
        });

        console.log("Reply sent successfully:", response.data); // Debugging
        return true;
    } catch (error) {
        console.error("Error sending reply:", error);
        return false;
    }
}


async function addEventToCalendar(user, eventDetails) {
    try {
        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        // Set credentials
        auth.setCredentials({
            access_token: user.accessToken,
            refresh_token: user.refreshToken,
            expiry_date: user.tokenExpiry,
        });

        const calendar = google.calendar({ version: "v3", auth });

        // Create the event
        const event = {
            summary: eventDetails.title,
            location: eventDetails.location,
            description: "Event extracted from email",
            start: {
                dateTime: `${eventDetails.date}T${eventDetails.time}:00`, // Combine date and time
                timeZone: "UTC", // Use the appropriate time zone
            },
            end: {
                dateTime: `${eventDetails.date}T${eventDetails.time}:00`, // Same as start time for simplicity
                timeZone: "UTC",
            },
        };

        const response = await calendar.events.insert({
            calendarId: "primary", // Use the primary calendar
            resource: event,
        });

        console.log("Event added to Google Calendar:", response.data); // Debugging
        return response.data;
    } catch (error) {
        console.error("Error adding event to Google Calendar:", error);
        throw error;
    }
}

module.exports = { getUnseenEmails, markEmailAsRead, sendReply, getEmailById, addEventToCalendar };


