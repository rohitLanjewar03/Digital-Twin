const express = require("express");
const { fetchUnseenEmails } = require("../controllers/emailController");
const { markEmailAsRead, sendReply, getEmailById } = require("../services/gmailService");
const { generateReply } = require("../services/geminiService");


const router = express.Router();

router.get("/unseen", fetchUnseenEmails);

router.post("/generate-reply/:emailId", async (req, res) => {
    try {
        const { emailId } = req.params;
        const { tone, userName } = req.body; // Extract tone and userName from the request body
        const user = req.session.user;

        if (!user) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        // Fetch the email content
        const email = await getEmailById(user, emailId);
        const reply = await generateReply(email.body, tone, userName); // Pass the user's name

        res.json({ reply });
    } catch (error) {
        console.error("Error generating reply:", error);
        res.status(500).json({ message: "Error generating reply" });
    }
});

router.post("/mark-as-read/:emailId", async (req, res) => {
    try {
        const { emailId } = req.params;
        const user = req.session.user;

        if (!user) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const success = await markEmailAsRead(user, emailId);
        if (success) {
            res.json({ message: "Email marked as read" });
        } else {
            res.status(500).json({ message: "Failed to mark email as read" });
        }
    } catch (error) {
        console.error("Error marking email as read:", error);
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/send-reply/:emailId", async (req, res) => {
    try {
        const { emailId } = req.params;
        const { replyContent } = req.body;
        const user = req.session.user;

        if (!user) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const success = await sendReply(user, emailId, replyContent);
        if (success) {
            res.json({ message: "Reply sent successfully" });
        } else {
            res.status(500).json({ message: "Failed to send reply" });
        }
    } catch (error) {
        console.error("Error sending reply:", error);
        res.status(500).json({ message: "Server error" });
    }
});


module.exports = router;
