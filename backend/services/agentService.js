const { GoogleGenerativeAI } = require("@google/generative-ai");
const { sendEmail } = require("./gmailService");
const OpenAI = require('openai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Parse the natural language instruction
async function parseInstruction(instruction) {
    try {
        try {
            // Try Gemini first
            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.0-flash-exp"
            });
            
            const prompt = `
            Parse the following instruction into structured task data. Return ONLY valid JSON.
            
            Instruction: "${instruction}"
            
            For email tasks, extract:
            - task: "send_email"
            - to: email address(es) of recipient(s) as a comma-separated string if multiple emails
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
            
            Sample output for multiple recipients "Send mails to john@example.com, jane@example.com about meeting":
            {
              "task": "send_email",
              "to": "john@example.com,jane@example.com",
              "subject": "Meeting",
              "content_topic": "meeting"
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
        } catch (geminiError) {
            // If Gemini fails with rate limit, fall back to OpenAI
            if (geminiError.status === 429) {
                console.log("Gemini quota exceeded, falling back to OpenAI for instruction parsing");
                const completion = await openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages: [
                        { role: "system", content: "You are a helpful assistant that parses email instructions into JSON. Always return valid JSON only." },
                        { role: "user", content: `Parse this instruction into JSON with fields: task, to, subject, content_topic. Instruction: "${instruction}"` }
                    ],
                    temperature: 0.3
                });
                const parsedText = completion.choices[0].message.content.trim();
                const jsonMatch = parsedText.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    return { task: "unknown" };
                }
                return JSON.parse(jsonMatch[0]);
            }
            throw geminiError;
        }
    } catch (error) {
        console.error("Error parsing instruction:", error);
        
        // Handle rate limit errors gracefully
        if (error.status === 429) {
            return { 
                task: "error", 
                error: "API quota exceeded. Please wait a moment and try again.",
                retryAfter: 30
            };
        }
        
        return { task: "unknown", error: error.message };
    }
}

// Generate email content based on topic
async function generateEmailContent(sender, topic, tone = "professional", recipient = "") {
    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.0-flash-exp"
        });
        
        // Handle recipient parameter - could be string, array, or comma-separated
        let recipientName = "";
        let recipientStr = "";
        
        if (recipient) {
            // Convert to string if it's an array
            if (Array.isArray(recipient)) {
                recipientStr = recipient.join(", ");
            } else if (typeof recipient === 'string') {
                recipientStr = recipient;
            }
            
            // Try to extract name from email formats like "John Doe <john@example.com>"
            if (recipientStr) {
                const nameMatch = recipientStr.match(/^([^<]+)</);
                if (nameMatch && nameMatch[1]) {
                    recipientName = nameMatch[1].trim();
                } else if (!recipientStr.includes('@')) {
                    // If no email pattern but also no @ symbol, might be just a name
                    recipientName = recipientStr;
                }
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
        
        try {
            // Try Gemini first
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
        } catch (geminiError) {
            // If Gemini fails with rate limit, fall back to OpenAI
            if (geminiError.status === 429) {
                console.log("Gemini quota exceeded, falling back to OpenAI for email generation");
                const completion = await openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages: [
                        { role: "system", content: `You are a helpful assistant that writes ${tone} emails. Always sign emails with "${sender}".` },
                        { role: "user", content: prompt }
                    ],
                    max_tokens: 500,
                    temperature: 0.7
                });
                let emailContent = completion.choices[0].message.content.trim();
                
                // Ensure the email has a sign-off with the sender's name
                if (!emailContent.includes(sender) && !emailContent.endsWith(sender)) {
                    if (emailContent.includes("Regards,") || emailContent.includes("Sincerely,") || 
                        emailContent.includes("Best,") || emailContent.includes("Thanks,")) {
                        emailContent = emailContent.replace(
                            /(Regards,|Sincerely,|Best,|Thanks,|Best regards,)(\s*)$/,
                            `$1\n${sender}`
                        );
                    } else {
                        emailContent = emailContent + `\n\nBest regards,\n${sender}`;
                    }
                }
                
                return emailContent;
            }
            throw geminiError;
        }
    } catch (error) {
        console.error("Error generating email content:", error);
        
        // Handle rate limit errors gracefully
        if (error.status === 429) {
            throw new Error("API quota exceeded. Please wait a moment and try again.");
        }
        
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