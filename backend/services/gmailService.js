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

async function markEmailAsRead(user, emailId) {
    try {
        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        auth.setCredentials({
            access_token: user.accessToken,
            refresh_token: user.refreshToken,
            expiry_date: user.tokenExpiry,
        });

        const gmail = google.gmail({ version: "v1", auth });

        // Mark email as read
        await gmail.users.messages.modify({
            userId: "me",
            id: emailId,
            requestBody: {
                removeLabelIds: ["UNREAD"],
            },
        });

        return true;
    } catch (error) {
        console.error("Error marking email as read:", error);
        return false;
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

module.exports = { getUnseenEmails, markEmailAsRead, getEmailById };

