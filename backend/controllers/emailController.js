const { getUnseenEmails } = require("../services/gmailService");

exports.fetchUnseenEmails = async (req, res) => {
    try {
        console.log("Session Data:", req.session);
        if (!req.session.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        // Pass the user object from the session
        const emails = await getUnseenEmails(req.session.user);
        res.json(emails);
    } catch (error) {
        res.status(500).json({ message: "Error fetching emails" });
    }
};