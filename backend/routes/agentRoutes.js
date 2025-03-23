const express = require("express");
const { isAuthenticated } = require("../middleware/authMiddleware");
const { parseInstruction, generateEmailContent } = require("../services/agentService");
const { sendEmail } = require("../services/gmailService");

const router = express.Router();

// Apply authentication middleware to all agent routes
router.use(isAuthenticated);

// Preview an email based on instruction
router.post("/preview", async (req, res) => {
    try {
        const { instruction } = req.body;
        const user = req.session.user;

        if (!instruction) {
            return res.status(400).json({ message: "No instruction provided" });
        }

        // Parse the instruction to determine what task to perform
        const taskDetails = await parseInstruction(instruction);
        
        if (!taskDetails || !taskDetails.task) {
            return res.status(400).json({ message: "Could not understand the instruction" });
        }

        // Handle different types of tasks
        if (taskDetails.task === "send_email") {
            // Generate a subject if not provided
            const subject = taskDetails.subject || `Information about ${taskDetails.content_topic}`;
            
            // Generate email content with recipient info for better greeting
            const content = await generateEmailContent(
                user.name, 
                taskDetails.content_topic,
                "professional",
                taskDetails.to // Pass recipient for better greeting
            );
            
            // Return the email details for preview
            return res.json({
                task: "send_email",
                emailDetails: {
                    to: taskDetails.to,
                    subject,
                    content,
                    content_topic: taskDetails.content_topic
                }
            });
        } else {
            return res.status(400).json({ message: `Task '${taskDetails.task}' is not supported yet` });
        }
    } catch (error) {
        console.error("Agent preview error:", error);
        res.status(500).json({ message: "Error generating email preview" });
    }
});

// Send an email after preview
router.post("/send-email", async (req, res) => {
    try {
        const emailDetails = req.body;
        const user = req.session.user;

        if (!emailDetails || !emailDetails.to || !emailDetails.subject) {
            return res.status(400).json({ message: "Missing required email details" });
        }

        // Send the email
        const success = await sendEmail(user, emailDetails.to, emailDetails.subject, emailDetails.content);
        
        if (success) {
            return res.json({
                message: `Email sent successfully to ${emailDetails.to}`,
                success: true,
                to: emailDetails.to,
                subject: emailDetails.subject
            });
        } else {
            return res.status(500).json({ message: "Failed to send the email" });
        }
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ message: "Error sending email" });
    }
});

// Original execute endpoint
router.post("/execute", async (req, res) => {
    try {
        const { instruction } = req.body;
        const user = req.session.user;

        if (!instruction) {
            return res.status(400).json({ message: "No instruction provided" });
        }

        // Parse the instruction to determine what task to perform
        const taskDetails = await parseInstruction(instruction);
        
        if (!taskDetails || !taskDetails.task) {
            return res.status(400).json({ message: "Could not understand the instruction" });
        }

        // Handle different types of tasks
        if (taskDetails.task === "send_email") {
            // Generate a subject if not provided
            const subject = taskDetails.subject || `Information about ${taskDetails.content_topic}`;
            
            // Generate email content with recipient info for better greeting
            const content = await generateEmailContent(
                user.name, 
                taskDetails.content_topic,
                "professional",
                taskDetails.to // Pass recipient for better greeting
            );
            
            // Send the email
            const success = await sendEmail(user, taskDetails.to, subject, content);
            
            if (success) {
                return res.json({
                    message: `Email sent successfully to ${taskDetails.to}`,
                    success: true,
                    emailSent: true,
                    to: taskDetails.to,
                    subject,
                    content
                });
            } else {
                return res.json({
                    message: "Failed to send the email. Please try again.",
                    success: false
                });
            }
        } else {
            return res.status(400).json({ message: `Task '${taskDetails.task}' is not supported yet` });
        }
    } catch (error) {
        console.error("Agent execution error:", error);
        res.status(500).json({ message: "Error executing instruction" });
    }
});

module.exports = router; 