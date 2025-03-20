const { getUnseenEmails } = require("../services/gmailService");
const { generateReply } = require("../services/geminiService");
const { getEmailById } = require("../services/gmailService");


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

exports.generateReply = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const { emailId, tone } = req.body;
        const user = req.session.user;

        // Fetch email content
        const email = await getEmailById(user, emailId);
        const reply = await generateReply(email.body, tone);

        res.json({ reply });
    } catch (error) {
        console.error("Error generating reply:", error);
        res.status(500).json({ message: "Error generating reply" });
    }
};