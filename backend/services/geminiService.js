require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Function to summarize email content
async function summarizeEmail(content) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash"});
        const prompt = `Summarize the following email content in 2-3 sentences:\n\n${content}`;
        console.log("Sending prompt to Gemini API:", prompt);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        console.log("Gemini API response:", response); 
        return response.text();
    } catch (error) {
        console.error("Error in summarizeEmail:", error);
        throw error;
    }
}

// Function to generate a reply
async function generateReply(content, tone = "professional") {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `Generate a ${tone} reply to the following email:\n\n${content}`;
        console.log("Sending prompt to Gemini API:", prompt); // Debugging
        const result = await model.generateContent(prompt);
        const response = await result.response;
        console.log("Gemini API response:", response); // Debugging
        return response.text();
    } catch (error) {
        console.error("Error in generateReply:", error);
        throw error;
    }
}



module.exports = { summarizeEmail, generateReply };