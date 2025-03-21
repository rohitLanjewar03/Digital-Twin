require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Function to summarize email content
async function summarizeEmail(content) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash"});
        const prompt = `Summarize the following email content in 2-3 sentences:\n\n${content}`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error in summarizeEmail:", error);
        throw error;
    }
}

// Function to generate a reply
async function generateReply(content, tone = "professional", userName) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // Customize the prompt to include the user's name
        const prompt = `Generate a ${tone} reply to the following email. Sign off with the name "${userName}":\n\n${content}`;
        console.log("Prompt:", prompt);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const reply = response.text();
        console.log("Reply:", reply);
        return reply;
    } catch (error) {
        console.error("Error in generateReply:", error);
        throw error;
    }
}

async function extractEventDetails(content) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // Prompt to extract event details
        const prompt = `Extract event details from the following email content. Provide the details in JSON format with the following keys: title, date, time, location. If any detail is missing, set its value to null:\n\n${content}`;
        console.log("Sending prompt to Gemini API:", prompt); // Debugging

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const jsonResponse = response.text();

        console.log("Raw Gemini API Response:", jsonResponse); // Debugging

        // Try to parse the JSON response directly
        let eventDetails;
        try {
            eventDetails = JSON.parse(jsonResponse);
        } catch (parseError) {
            console.error("Failed to parse JSON response:", parseError);
            throw new Error("Invalid JSON response from Gemini API");
        }

        // Validate and set default values for missing fields
        if (!eventDetails) {
            throw new Error("No event details extracted from email");
        }

        const validatedDetails = {
            title: eventDetails.title || null,
            date: eventDetails.date || null,
            time: eventDetails.time || null,
            location: eventDetails.location || null,
        };

        console.log("Extracted Event Details:", validatedDetails); // Debugging
        return validatedDetails;
    } catch (error) {
        console.error("Error extracting event details:", error);
        throw new Error("Invalid event details extracted from email");
    }
}
module.exports = { summarizeEmail, generateReply, extractEventDetails };