const { GoogleGenerativeAI } = require("@google/generative-ai");
const { sendEmail } = require("./gmailService");

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Parse the natural language instruction
async function parseInstruction(instruction) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const prompt = `
        Parse the following instruction into structured task data. Return ONLY valid JSON.
        
        Instruction: "${instruction}"
        
        For email tasks, extract:
        - task: "send_email"
        - to: email address(es) of recipient(s)
        - subject: email subject
        - content_topic: what the email should be about

        If the instruction isn't clear or doesn't specify a supported task, set task to "unknown".
        
        Sample output for "Send an email to john@example.com about the project update":
        {
          "task": "send_email",
          "to": "john@example.com",
          "subject": "Project Update",
          "content_topic": "project update"
        }
        
        Return ONLY the JSON object, no other text.
        `;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const parsedText = response.text().trim();
        
        // Extract JSON from the response (in case there's any surrounding text)
        const jsonMatch = parsedText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error("Failed to extract JSON from AI response");
            return { task: "unknown" };
        }
        
        const jsonStr = jsonMatch[0];
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Error parsing instruction:", error);
        return { task: "unknown", error: error.message };
    }
}

// Generate email content based on topic
async function generateEmailContent(sender, topic, tone = "professional", recipient = "") {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        // Extract recipient name if it exists
        let recipientName = "";
        if (recipient) {
            // Try to extract name from email formats like "John Doe <john@example.com>"
            const nameMatch = recipient.match(/^([^<]+)</);
            if (nameMatch && nameMatch[1]) {
                recipientName = nameMatch[1].trim();
            } else if (!recipient.includes('@')) {
                // If no email pattern but also no @ symbol, might be just a name
                recipientName = recipient;
            }
        }
        
        const prompt = `
        Write a ${tone} email about "${topic}".
        
        IMPORTANT GUIDELINES:
        - NEVER use placeholder text or brackets like [Name] or [Company]
        ${recipientName ? `- Address the recipient as "${recipientName}"` : '- Use an appropriate generic greeting like "Hello" or "Hi there"'}
        - NEVER include meta-commentary like "I don't know what to write" or "Without more context"
        - Write a complete, natural-sounding email with proper formatting
        - Include 2-3 substantive paragraphs about the topic
        - Always sign off with "${sender}" at the end
        - Be specific and direct about the topic
        
        Generate a complete, ready-to-send email:`;
        
        // Set generation parameters for better quality
        const generationConfig = {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 800,
        };
        
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig,
        });
        
        const response = await result.response;
        let emailContent = response.text().trim();
        
        // Ensure the email has a sign-off with the sender's name
        if (!emailContent.includes(sender) && !emailContent.endsWith(sender)) {
            if (emailContent.includes("Regards,") || emailContent.includes("Sincerely,") || 
                emailContent.includes("Best,") || emailContent.includes("Thanks,")) {
                // The email has a sign-off but is missing the name
                emailContent = emailContent.replace(
                    /(Regards,|Sincerely,|Best,|Thanks,|Best regards,)(\s*)$/,
                    `$1\n${sender}`
                );
            } else {
                // No sign-off detected, add one
                emailContent = emailContent + `\n\nBest regards,\n${sender}`;
            }
        }
        
        return emailContent;
    } catch (error) {
        console.error("Error generating email content:", error);
        throw error;
    }
}

// Execute an email task
async function executeEmailTask(user, taskDetails) {
    try {
        // Validate email recipients
        if (!taskDetails.to) {
            return { 
                message: "Could not determine the email recipient. Please specify a valid email address.",
                success: false
            };
        }
        
        // Generate a subject if not provided
        const subject = taskDetails.subject || `Information about ${taskDetails.content_topic}`;
        
        // Generate email content
        const content = await generateEmailContent(
            user.name, 
            taskDetails.content_topic
        );
        
        // Send the email
        const success = await sendEmail(user, taskDetails.to, subject, content);
        
        if (success) {
            return {
                message: `Email sent successfully to ${taskDetails.to}`,
                success: true,
                emailSent: true,
                to: taskDetails.to,
                subject,
                content
            };
        } else {
            return {
                message: "Failed to send the email. Please try again.",
                success: false
            };
        }
    } catch (error) {
        console.error("Error executing email task:", error);
        return { 
            message: "An error occurred while processing your request: " + error.message,
            success: false
        };
    }
}

module.exports = { parseInstruction, executeEmailTask, generateEmailContent }; 