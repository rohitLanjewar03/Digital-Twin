const express = require("express");
const { fetchUnseenEmails, generateReply } = require("../controllers/emailController");
const { markEmailAsRead } = require("../services/gmailService");


const router = express.Router();

router.get("/unseen", fetchUnseenEmails);
router.post("/generate-reply", generateReply);
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


module.exports = router;
