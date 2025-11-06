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
        const { instruction, tone = "professional" } = req.body;
        const user = req.session.user;

        if (!instruction) {
            return res.status(400).json({ message: "No instruction provided" });
        }

        // Parse the instruction to determine what task to perform
        const taskDetails = await parseInstruction(instruction);
        
        // Handle rate limit errors
        if (taskDetails.task === "error") {
            return res.status(429).json({ 
                message: taskDetails.error,
                retryAfter: taskDetails.retryAfter 
            });
        }
        
        if (!taskDetails || !taskDetails.task) {
            return res.status(400).json({ message: "Could not understand the instruction" });
        }

        // Handle different types of tasks
        if (taskDetails.task === "send_email") {
            // Generate a subject if not provided
            const subject = taskDetails.subject || `Information about ${taskDetails.content_topic}`;
            
            // Parse multiple recipients (could be comma-separated string)
            let recipients = [];
            if (typeof taskDetails.to === 'string') {
                recipients = taskDetails.to.split(',').map(email => email.trim()).filter(email => email);
            } else if (Array.isArray(taskDetails.to)) {
                recipients = taskDetails.to;
            } else {
                recipients = [taskDetails.to];
            }
            
            // Generate email content with recipient info for better greeting
            const content = await generateEmailContent(
                user.name, 
                taskDetails.content_topic,
                tone, // Use the tone from the request
                recipients[0] // Pass first recipient for greeting
            );
            
            // Return the email details for preview
            return res.json({
                task: "send_email",
                emailDetails: {
                    to: recipients, // Return as array
                    toDisplay: recipients.join(', '), // For display purposes
                    subject,
                    content,
                    content_topic: taskDetails.content_topic,
                    tone // Include tone in the response
                }
            });
        } else {
            return res.status(400).json({ message: `Task '${taskDetails.task}' is not supported yet` });
        }
    } catch (error) {
        console.error("Agent preview error:", error);
        
        // Handle rate limit errors
        if (error.message && error.message.includes("quota exceeded")) {
            return res.status(429).json({ 
                message: "API quota exceeded. Please wait a moment and try again.",
                retryAfter: 30
            });
        }
        
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

        // Handle multiple recipients
        let recipients = [];
        if (typeof emailDetails.to === 'string') {
            recipients = emailDetails.to.split(',').map(email => email.trim()).filter(email => email);
        } else if (Array.isArray(emailDetails.to)) {
            recipients = emailDetails.to;
        } else {
            recipients = [emailDetails.to];
        }

        // Send emails to all recipients
        const results = [];
        const errors = [];
        
        for (const recipient of recipients) {
            try {
                const success = await sendEmail(user, recipient, emailDetails.subject, emailDetails.content);
                if (success) {
                    results.push(recipient);
                } else {
                    errors.push(recipient);
                }
            } catch (error) {
                console.error(`Error sending to ${recipient}:`, error);
                errors.push(recipient);
            }
        }
        
        if (results.length > 0) {
            return res.json({
                message: `Email sent successfully to ${results.length} recipient(s): ${results.join(', ')}`,
                success: true,
                sentTo: results,
                failedTo: errors.length > 0 ? errors : undefined,
                subject: emailDetails.subject
            });
        } else {
            return res.status(500).json({ 
                message: "Failed to send the email to any recipients",
                failedTo: errors
            });
        }
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ message: "Error sending email" });
    }
});

router.post("/execute", async (req, res) => {
    try {
        const { instruction, tone = "professional" } = req.body;
        const user = req.session.user;

        if (!instruction) {
            return res.status(400).json({ message: "No instruction provided" });
        }

        // Parse the instruction to determine what task to perform
        const taskDetails = await parseInstruction(instruction);
        
        // Handle rate limit errors
        if (taskDetails.task === "error") {
            return res.status(429).json({ 
                message: taskDetails.error,
                retryAfter: taskDetails.retryAfter 
            });
        }
        
        if (!taskDetails || !taskDetails.task) {
            return res.status(400).json({ message: "Could not understand the instruction" });
        }

        // Handle different types of tasks
        if (taskDetails.task === "send_email") {
            // Generate a subject if not provided
            const subject = taskDetails.subject || `Information about ${taskDetails.content_topic}`;
            
            // Parse multiple recipients (could be comma-separated string)
            let recipients = [];
            if (typeof taskDetails.to === 'string') {
                recipients = taskDetails.to.split(',').map(email => email.trim()).filter(email => email);
            } else if (Array.isArray(taskDetails.to)) {
                recipients = taskDetails.to;
            } else {
                recipients = [taskDetails.to];
            }
            
            // Generate email content with recipient info for better greeting
            const content = await generateEmailContent(
                user.name, 
                taskDetails.content_topic,
                tone, // Use the tone from the request
                recipients[0] // Pass first recipient for greeting
            );
            
            // Send emails to all recipients
            const results = [];
            const errors = [];
            
            for (const recipient of recipients) {
                try {
                    const success = await sendEmail(user, recipient, subject, content);
                    if (success) {
                        results.push(recipient);
                    } else {
                        errors.push(recipient);
                    }
                } catch (error) {
                    console.error(`Error sending to ${recipient}:`, error);
                    errors.push(recipient);
                }
            }
            
            if (results.length > 0) {
                return res.json({
                    message: `Email sent successfully to ${results.length} recipient(s): ${results.join(', ')}`,
                    success: true,
                    emailSent: true,
                    sentTo: results,
                    failedTo: errors.length > 0 ? errors : undefined,
                    subject,
                    content,
                    tone // Include tone in the response
                });
            } else {
                return res.json({
                    message: "Failed to send the email to any recipients. Please try again.",
                    success: false,
                    failedTo: errors
                });
            }
        } else {
            return res.status(400).json({ message: `Task '${taskDetails.task}' is not supported yet` });
        }
    } catch (error) {
        console.error("Agent execution error:", error);
        
        // Handle rate limit errors
        if (error.message && error.message.includes("quota exceeded")) {
            return res.status(429).json({ 
                message: "API quota exceeded. Please wait a moment and try again.",
                retryAfter: 30
            });
        }
        
        res.status(500).json({ message: "Error executing instruction" });
    }
});

module.exports = router;