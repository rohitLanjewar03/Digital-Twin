const { google } = require("googleapis");
const { summarizeEmail } = require("./geminiService");

async function getUnseenEmails(user) {
    try {
        if (!user || !user.accessToken) {
            throw new Error("User not authenticated");
        }

        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        // Set credentials
        auth.setCredentials({
            access_token: user.accessToken,
            refresh_token: user.refreshToken,
            expiry_date: user.tokenExpiry,
        });

        // Refresh token if expired
        if (auth.isTokenExpiring()) {
            try {
                const { tokens } = await auth.refreshAccessToken();
                auth.setCredentials(tokens);

                // Update the user's tokens in the database
                user.accessToken = tokens.access_token;
                user.refreshToken = tokens.refresh_token || user.refreshToken;
                user.tokenExpiry = tokens.expiry_date;
                await user.save();
            } catch (refreshError) {
                console.error("Token refresh error:", refreshError);
                throw new Error("Failed to refresh authentication token");
            }
        }

        const gmail = google.gmail({ version: "v1", auth });

        // Search for unread emails
        const response = await gmail.users.messages.list({
            userId: "me",
            q: "is:unread",
            maxResults: 10,
        });

        const messages = response.data.messages || [];

        // Fetch email details and summarize
        const emails = await Promise.all(
            messages.map(async (msg) => {
                try {
                    const email = await gmail.users.messages.get({
                        userId: "me",
                        id: msg.id,
                        format: "full",
                    });

                    const headers = email.data.payload.headers;
                    const subject = headers.find((h) => h.name === "Subject")?.value || "No Subject";
                    const fromHeader = headers.find((h) => h.name === "From")?.value || "Unknown Sender";
                    
                    // Parse email address more carefully
                    let from = fromHeader;
                    if (fromHeader.includes("<") && fromHeader.includes(">")) {
                        // Extract both name and email address for clarity
                        const nameMatch = fromHeader.match(/(.*?)\s*<.*>/);
                        const emailMatch = fromHeader.match(/<(.*?)>/);
                        const name = nameMatch ? nameMatch[1].trim() : "";
                        const email = emailMatch ? emailMatch[1].trim() : fromHeader;
                        
                        // Format as "Name <email@example.com>"
                        from = name ? `${name} <${email}>` : email;
                    }
                    
                    // Extract email body more carefully
                    let body = "";
                    
                    // Check for plain text parts first
                    if (email.data.payload.parts) {
                        const plainTextPart = email.data.payload.parts.find(
                            part => part.mimeType === "text/plain"
                        );
                        
                        if (plainTextPart && plainTextPart.body.data) {
                            const buff = Buffer.from(plainTextPart.body.data, 'base64');
                            body = buff.toString();
                        }
                    }
                    
                    // If no plain text found, try to get from body or snippet
                    if (!body && email.data.payload.body && email.data.payload.body.data) {
                        const buff = Buffer.from(email.data.payload.body.data, 'base64');
                        body = buff.toString();
                    }
                    
                    // Fall back to snippet if still no body
                    if (!body) {
                        body = email.data.snippet || "";
                    }
                    
                    // Clean the body text - remove excessive newlines and spaces
                    body = body.replace(/\n{3,}/g, '\n\n').trim();
                    
                    // Capture enough content for AI to understand the context
                    // Limit to 1000 chars to avoid token issues but keep context
                    const contextRichBody = body.length > 1000 
                        ? body.substring(0, 1000) + "..." 
                        : body;

                    // Summarize email content
                    let summary;
                    try {
                        summary = await summarizeEmail(contextRichBody);
                    } catch (summaryError) {
                        console.error("Error summarizing email:", summaryError);
                        summary = "Summary unavailable. Please check the email directly.";
                    }

                    return { 
                        id: msg.id, 
                        from, 
                        subject, 
                        body: contextRichBody,
                        summary
                    };
                } catch (emailError) {
                    console.error(`Error processing email ${msg.id}:`, emailError);
                    return { 
                        id: msg.id, 
                        from: "Error retrieving sender", 
                        subject: "Error retrieving subject", 
                        body: "", 
                        summary: "Error retrieving email content"
                    };
                }
            })
        );

        return emails;
    } catch (error) {
        console.error("Error fetching unseen emails:", error);
        throw error; // Propagate the error to be handled by the caller
    }
}

async function getEmailById(user, emailId) {
    try {
        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        // Set credentials
        auth.setCredentials({
            access_token: user.accessToken,
            refresh_token: user.refreshToken,
            expiry_date: user.tokenExpiry,
        });

        const gmail = google.gmail({ version: "v1", auth });

        // Fetch email by ID
        const email = await gmail.users.messages.get({
            userId: "me",
            id: emailId,
            format: "full", // Fetch full email content
        });

        // Extract email headers
        const headers = email.data.payload.headers;
        const subject = headers.find((h) => h.name === "Subject")?.value || "No Subject";
        const fromHeader = headers.find((h) => h.name === "From")?.value || "Unknown Sender";
        
        // Parse email address more carefully
        let from = fromHeader;
        if (fromHeader.includes("<") && fromHeader.includes(">")) {
            // Extract both name and email address
            const nameMatch = fromHeader.match(/(.*?)\s*<.*>/);
            const emailMatch = fromHeader.match(/<(.*?)>/);
            const name = nameMatch ? nameMatch[1].trim() : "";
            const email = emailMatch ? emailMatch[1].trim() : fromHeader;
            
            // Format as "Name <email@example.com>"
            from = name ? `${name} <${email}>` : email;
        }
        
        // Extract content to reply to
        let body = "";
        
        // Function to decode base64 content
        const decodeBase64 = (data) => {
            if (!data) return "";
            const buff = Buffer.from(data, 'base64');
            return buff.toString('utf-8');
        };
        
        // Function to extract text content from parts recursively
        const extractTextFromParts = (parts) => {
            if (!parts) return "";
            
            // First look for text/plain parts
            for (const part of parts) {
                if (part.mimeType === "text/plain" && part.body && part.body.data) {
                    return decodeBase64(part.body.data);
                }
            }
            
            // If no text/plain, try text/html
            for (const part of parts) {
                if (part.mimeType === "text/html" && part.body && part.body.data) {
                    // This is HTML, but we'll extract it as a fallback
                    // In a more complete solution, you'd convert HTML to plain text
                    return decodeBase64(part.body.data)
                        .replace(/<[^>]*>/g, '') // Simple HTML tag removal
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&amp;/g, '&')
                        .replace(/\s+/g, ' ');
                }
            }
            
            // Recursively check nested parts
            let text = "";
            for (const part of parts) {
                if (part.parts) {
                    const nestedText = extractTextFromParts(part.parts);
                    if (nestedText) {
                        text += nestedText + "\n";
                    }
                }
            }
            
            return text.trim();
        };
        
        // Try to extract text from parts
        if (email.data.payload.parts) {
            body = extractTextFromParts(email.data.payload.parts);
        }
        
        // If no body found, try direct body data
        if (!body && email.data.payload.body && email.data.payload.body.data) {
            body = decodeBase64(email.data.payload.body.data);
        }
        
        // Last resort, use snippet
        if (!body) {
            body = email.data.snippet || "";
        }
        
        // Clean up the body text
        body = body.trim()
            .replace(/\n{3,}/g, '\n\n')  // Remove excessive newlines
            .replace(/^\s*>+\s*>/gm, '') // Remove excessive quote markers
            .trim();
            
        // Get recipient for reply purposes
        const to = headers.find((h) => h.name === "To")?.value || user.email;
        const messageId = headers.find((h) => h.name === "Message-ID")?.value || "";
        
        return { id: emailId, from, to, subject, body, messageId };
    } catch (error) {
        console.error("Error fetching email by ID:", error);
        throw error;
    }
}


async function markEmailAsRead(user, emailId) {
    try {
        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        // Set credentials
        auth.setCredentials({
            access_token: user.accessToken,
            refresh_token: user.refreshToken,
            expiry_date: user.tokenExpiry,
        });

        const gmail = google.gmail({ version: "v1", auth });

        // Mark email as read by removing the UNREAD label
        const response = await gmail.users.messages.modify({
            userId: "me",
            id: emailId,
            requestBody: {
                removeLabelIds: ["UNREAD"], // Remove the UNREAD label
            },
        });

        console.log("Email marked as read:", response.data); // Debugging
        return true;
    } catch (error) {
        console.error("Error marking email as read:", error);
        return false;
    }
}

async function sendReply(user, emailId, replyContent) {
    try {
        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        // Set credentials
        auth.setCredentials({
            access_token: user.accessToken,
            refresh_token: user.refreshToken,
            expiry_date: user.tokenExpiry,
        });

        const gmail = google.gmail({ version: "v1", auth });

        // Fetch the original email to get the necessary headers
        const email = await gmail.users.messages.get({
            userId: "me",
            id: emailId,
            format: "metadata",
            metadataHeaders: ["From", "To", "Subject", "Message-ID", "References", "In-Reply-To"],
        });

        // Extract headers safely
        const headers = email.data.payload.headers || [];
        const getHeader = (name) => headers.find(h => h.name === name)?.value || "";
        
        const from = getHeader("From");
        const subject = getHeader("Subject");
        const originalMessageId = getHeader("Message-ID");
        const references = getHeader("References");
        
        // Extract recipient email (the "From" of original email)
        let replyTo = from;
        // Extract just the email address from the "From" field if necessary
        if (replyTo.includes("<") && replyTo.includes(">")) {
            const match = replyTo.match(/<(.+?)>/);
            if (match && match[1]) {
                replyTo = match[1];
            }
        }
        
        // Prepare References header
        let referencesHeader = originalMessageId;
        if (references) {
            referencesHeader = `${references} ${originalMessageId}`;
        }
        
        // Format subject (add Re: if not already present)
        let replySubject = subject;
        if (!replySubject.toLowerCase().startsWith("re:")) {
            replySubject = `Re: ${replySubject}`;
        }
        
        // Create the reply message with proper RFC822 headers
        const replyMessage = [
            `From: ${user.name} <${user.email}>`,
            `To: ${replyTo}`,
            `Subject: ${replySubject}`,
            `In-Reply-To: ${originalMessageId}`,
            `References: ${referencesHeader}`,
            "Content-Type: text/plain; charset=utf-8",
            "MIME-Version: 1.0",
            "",
            replyContent,
        ].join("\r\n"); // Use CRLF as per email standards

        // Encode the message in base64url format
        const encodedMessage = Buffer.from(replyMessage)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

        // Send the reply
        const response = await gmail.users.messages.send({
            userId: "me",
            requestBody: {
                raw: encodedMessage,
                threadId: email.data.threadId, // Ensure reply is part of the same thread
            },
        });

        console.log("Reply sent successfully:", response.data); // Debugging
        return true;
    } catch (error) {
        console.error("Error sending reply:", error);
        return false;
    }
}

async function sendEmail(user, recipient, subject, content) {
    try {
        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        // Set credentials
        auth.setCredentials({
            access_token: user.accessToken,
            refresh_token: user.refreshToken,
            expiry_date: user.tokenExpiry,
        });

        const gmail = google.gmail({ version: "v1", auth });

        // Clean recipient email
        let toEmail = recipient;
        if (toEmail.includes("<") && toEmail.includes(">")) {
            const match = toEmail.match(/<(.+?)>/);
            if (match && match[1]) {
                toEmail = match[1];
            }
        }

        // Create the email message
        const emailMessage = [
            `From: ${user.name} <${user.email}>`,
            `To: ${toEmail}`,
            `Subject: ${subject}`,
            "Content-Type: text/plain; charset=utf-8",
            "MIME-Version: 1.0",
            "",
            content,
        ].join("\r\n");

        // Encode the message
        const encodedMessage = Buffer.from(emailMessage)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

        // Send the email
        const response = await gmail.users.messages.send({
            userId: "me",
            requestBody: {
                raw: encodedMessage,
            },
        });

        console.log("Email sent successfully:", response.data);
        return true;
    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
}

// Function to add event to Google Calendar
async function addEventToCalendar(user, eventDetails) {
    try {
        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        // Set credentials
        auth.setCredentials({
            access_token: user.accessToken,
            refresh_token: user.refreshToken,
            expiry_date: user.tokenExpiry,
        });

        const calendar = google.calendar({ version: "v3", auth });
        
        // Set default values for missing fields
        const title = eventDetails.title || "Untitled Event";
        
        // Current date in YYYY-MM-DD format if date is missing
        let eventDate = eventDetails.date;
        if (!eventDate) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            eventDate = tomorrow.toISOString().split('T')[0];
        }
        
        // Default time (noon) if time is missing
        const startTime = eventDetails.time || "12:00";
        
        // Calculate end time (1 hour after start if not specified)
        let endTime;
        if (eventDetails.endTime) {
            endTime = eventDetails.endTime;
        } else {
            const [hours, minutes] = startTime.split(':').map(Number);
            const startDate = new Date();
            startDate.setHours(hours, minutes, 0);
            const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour later
            endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
        }
        
        // Create datetime strings
        const startDateTime = `${eventDate}T${startTime}:00`;
        const endDateTime = `${eventDate}T${endTime}:00`;
        
        // Create the calendar event
        const event = {
            summary: title,
            location: eventDetails.location || '',
            description: eventDetails.description || 'Event added from email',
            start: {
                dateTime: startDateTime,
                timeZone: 'UTC',
            },
            end: {
                dateTime: endDateTime,
                timeZone: 'UTC',
            },
            reminders: {
                useDefault: true,
            },
        };
        
        // Insert the event into the calendar
        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
        });
        
        console.log('Event created:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error adding event to calendar:', error);
        throw error;
    }
}

module.exports = { getUnseenEmails, markEmailAsRead, sendReply, getEmailById, sendEmail, addEventToCalendar };


