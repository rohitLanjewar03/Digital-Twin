require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { google } = require("googleapis");

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize Google Calendar OAuth2 client
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

// Set Google Calendar API credentials
oauth2Client.setCredentials({
    access_token: process.env.GOOGLE_ACCESS_TOKEN,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

// Function to summarize email content
async function summarizeEmail(content) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
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

// Function to extract event details from email content
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
            // Remove Markdown code block formatting if present
            const jsonMatch = jsonResponse.match(/```json\n([\s\S]*?)\n```/);
            const jsonString = jsonMatch ? jsonMatch[1].trim() : jsonResponse.trim();
            eventDetails = JSON.parse(jsonString);
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

// Function to add an event to Google Calendar
async function addEventToGoogleCalendar(user, eventDetails) {
    try {
        // Initialize OAuth2 client with user-specific credentials
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        // Set user-specific credentials
        oauth2Client.setCredentials({
            access_token: user.googleAccessToken,
            refresh_token: user.googleRefreshToken,
        });

        const calendar = google.calendar({ version: "v3", auth: oauth2Client });

        const event = {
            summary: eventDetails.title || "Event",
            location: eventDetails.location || null,
            description: "Event created via Digital Twin App",
            start: {
                dateTime: `${eventDetails.date}T${eventDetails.time}:00`,
                timeZone: "UTC", // Use user's time zone if available
            },
            end: {
                dateTime: `${eventDetails.date}T${eventDetails.time}:00`,
                timeZone: "UTC", // Use user's time zone if available
            },
        };

        console.log("Event to be added:", event); // Debugging

        const response = await calendar.events.insert({
            calendarId: "primary",
            resource: event,
        });

        console.log("Google Calendar Response:", response.data); // Debugging
        return response.data;
    } catch (error) {
        console.error("Error adding event to Google Calendar:", error);
        throw new Error("Failed to add event to Google Calendar");
    }
}
// Export all functions
module.exports = { summarizeEmail, generateReply, extractEventDetails, addEventToGoogleCalendar };