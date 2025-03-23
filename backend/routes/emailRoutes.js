const express = require("express");
const { fetchUnseenEmails } = require("../controllers/emailController");
const { markEmailAsRead, sendReply, getEmailById, addEventToCalendar } = require("../services/gmailService");
const { generateReply, extractEventDetails } = require("../services/geminiService");
const { isAuthenticated } = require("../middleware/authMiddleware");

const router = express.Router();

// Apply isAuthenticated middleware to all email routes
router.use(isAuthenticated);

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
        
        if (!email || !email.body) {
            return res.status(404).json({ 
                message: "Email content could not be retrieved",
                reply: `I received your email, but couldn't access the content properly. Please let me know how I can assist you.\n\nBest regards,\n${userName}`
            });
        }
        
        // Generate reply with enhanced context
        const enhancedContext = `
        FROM: ${email.from}
        SUBJECT: ${email.subject}
        
        EMAIL CONTENT:
        ${email.body}
        `;
        
        const reply = await generateReply(enhancedContext, tone, userName);

        res.json({ reply });
    } catch (error) {
        console.error("Error generating reply:", error);
        res.status(500).json({ 
            message: "Error generating reply",
            reply: `Thank you for your email. I've received your message and will review it properly soon.\n\nBest regards,\n${req.body.userName || "Me"}`
        });
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

// Add event to calendar
router.post("/add-to-calendar/:emailId", async (req, res) => {
    try {
        const { emailId } = req.params;
        const user = req.session.user;

        // Fetch the email content
        const email = await getEmailById(user, emailId);
        
        if (!email || !email.body) {
            return res.status(404).json({ 
                message: "Email content could not be retrieved",
                success: false
            });
        }
        
        // Extract event details from the email
        const eventDetails = await extractEventDetails(email.body, email.subject);
        
        if (!eventDetails || !eventDetails.title) {
            return res.json({ 
                noEventFound: true,
                success: false,
                message: "No event details found in this email"
            });
        }
        
        // Add the event to the calendar
        const result = await addEventToCalendar(user, eventDetails);
        
        res.json({
            success: true,
            message: "Event added to calendar",
            eventDetails: result
        });
    } catch (error) {
        console.error("Error adding event to calendar:", error);
        res.status(500).json({ 
            message: "Error adding event to calendar",
            success: false
        });
    }
});

module.exports = router;
