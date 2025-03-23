require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Function to summarize email content
async function summarizeEmail(content) {
    try {
        if (!content || content.trim() === "") {
            return "No email content to summarize.";
        }
        
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});
        const prompt = `Summarize the following email content in 2-3 sentences. Focus on the key request or information being conveyed:
        
        ${content}`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error in summarizeEmail:", error);
        // For quota errors, return a generic summary instead of throwing
        if (error.status === 429) {
            return "Email content summary unavailable (API quota exceeded). Please check the email directly.";
        }
        // For other errors, throw to be handled by caller
        throw error;
    }
}

// Function to generate a reply
async function generateReply(content, tone = "professional", userName) {
    try {
        if (!content || content.trim() === "") {
            return `I received your email, but couldn't parse the content properly. Please let me know how I can assist you.\n\nBest regards,\n${userName}`;
        }
        
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Enhanced prompt with clear instructions for natural email replies
        const prompt = `
        You are writing an email reply as ${userName}. Use a ${tone} tone.
        
        IMPORTANT GUIDELINES:
        - NEVER use placeholder text or brackets like [Name] or [Company]
        - If you don't know the recipient's name, use an appropriate generic greeting like "Hello" or "Hi there"
        - NEVER include meta-commentary like "I don't know what to write" or "Without more context"
        - NEVER mention that you're an AI or language model
        - Write a complete, natural-sounding email that directly addresses the content
        - Use appropriate greetings based on the context of the original email
        - Always sign off with "${userName}" at the end
        - Be specific about anything mentioned in the original email
        
        ORIGINAL EMAIL:
        ${content}
        
        Write your complete ${tone} reply below:`;
        
        // Set generation parameters for better quality
        const generationConfig = {
            temperature: 0.7,  // Add some creativity without being too random
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 800,  // Allow for reasonably detailed responses
        };
        
        console.log("Prompt:", prompt);
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig,
        });
        
        const response = await result.response;
        let reply = response.text().trim();
        
        // Ensure the reply has a sign-off with the user's name if it doesn't already
        if (!reply.includes(userName) && !reply.endsWith(userName)) {
            if (reply.includes("Regards,") || reply.includes("Sincerely,") || 
                reply.includes("Best,") || reply.includes("Thanks,")) {
                // The reply has a sign-off but is missing the name
                reply = reply.replace(/(Regards,|Sincerely,|Best,|Thanks,|Best regards,)(\s*)$/, `$1\n${userName}`);
            } else {
                // No sign-off detected, add one
                reply = reply + `\n\nBest regards,\n${userName}`;
            }
        }
        
        console.log("Reply:", reply);
        return reply;
    } catch (error) {
        console.error("Error in generateReply:", error);
        // For quota errors, return a generic message
        if (error.status === 429) {
            return `Thank you for your email. I've received your message and will get back to you with a proper response soon.\n\nBest regards,\n${userName}`;
        }
        throw error;
    }
}

// Function to extract event details from email content
async function extractEventDetails(content, subject = "") {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const prompt = `
        Extract event details from the following email content. If there's an event mentioned, provide details in the following JSON format:
        
        {
          "title": "Event Title/Name",
          "date": "YYYY-MM-DD format date",
          "time": "HH:MM 24-hour format time",
          "endTime": "HH:MM 24-hour format end time (if mentioned)",
          "location": "Event location or venue",
          "description": "Brief description of the event"
        }
        
        If a specific detail is not mentioned, set it to null. If you can infer the information (like date from "next Monday"), please convert it to the explicit format.
        
        Email Subject: ${subject}
        
        Email Content:
        ${content}
        
        If there is no event information in this email, return {"noEvent": true}.
        Return ONLY the JSON object, no other text.
        `;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const parsedText = response.text().trim();
        
        // Extract JSON from the response
        const jsonMatch = parsedText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error("Failed to extract JSON from AI response");
            return null;
        }
        
        const jsonStr = jsonMatch[0];
        const parsedEvent = JSON.parse(jsonStr);
        
        // If AI indicated no event found
        if (parsedEvent.noEvent) {
            return null;
        }
        
        // Process date if present but needs conversion
        if (parsedEvent.date) {
            // Ensure date format is YYYY-MM-DD
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(parsedEvent.date)) {
                try {
                    // Try to parse the date and convert to YYYY-MM-DD
                    const date = new Date(parsedEvent.date);
                    if (!isNaN(date.getTime())) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        parsedEvent.date = `${year}-${month}-${day}`;
                    }
                } catch (dateError) {
                    console.error("Error parsing date:", dateError);
                }
            }
        }
        
        // Process time if present
        if (parsedEvent.time) {
            // Ensure time format is HH:MM
            const timeRegex = /^\d{2}:\d{2}$/;
            if (!timeRegex.test(parsedEvent.time)) {
                try {
                    // Try to extract hours and minutes
                    const timeMatch = parsedEvent.time.match(/(\d{1,2})[:\s](\d{2})(?:\s*([APap][Mm]))?/);
                    if (timeMatch) {
                        let hours = parseInt(timeMatch[1]);
                        const minutes = timeMatch[2];
                        const ampm = timeMatch[3]?.toUpperCase();
                        
                        // Convert to 24-hour format if AM/PM is specified
                        if (ampm === 'PM' && hours < 12) hours += 12;
                        if (ampm === 'AM' && hours === 12) hours = 0;
                        
                        parsedEvent.time = `${String(hours).padStart(2, '0')}:${minutes}`;
                    }
                } catch (timeError) {
                    console.error("Error parsing time:", timeError);
                }
            }
        }
        
        return parsedEvent;
    } catch (error) {
        console.error("Error extracting event details:", error);
        return null;
    }
}

module.exports = { summarizeEmail, generateReply, extractEventDetails };