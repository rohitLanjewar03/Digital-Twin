const { google } = require("googleapis");

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
            refresh_token: user.refreshToken, // Ensure this is stored in the DB
            expiry_date: user.tokenExpiry,   // Optional: Store and check expiry
        });

        // Refresh token if expired
        if (auth.isTokenExpiring()) {
            const { tokens } = await auth.refreshAccessToken();
            auth.setCredentials(tokens);

            // Update the user's tokens in the database
            user.accessToken = tokens.access_token;
            user.refreshToken = tokens.refresh_token || user.refreshToken; // Refresh token may not always be returned
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

        // Fetch email details
        const emails = await Promise.all(
            messages.map(async (msg) => {
                const email = await gmail.users.messages.get({
                    userId: "me",
                    id: msg.id,
                });

                const headers = email.data.payload.headers;
                const subject = headers.find((h) => h.name === "Subject")?.value;
                const from = headers.find((h) => h.name === "From")?.value;

                return { id: msg.id, from, subject };
            })
        );

        return emails;
    } catch (error) {
        console.error("Error fetching unseen emails:", error);
        return [];
    }
}

module.exports = { getUnseenEmails };