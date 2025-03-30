import { useState } from "react";
import { useAuth } from "../context/useAuth";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const AIAgent = () => {
    const { user } = useAuth();
    const [instruction, setInstruction] = useState("");
    const [processing, setProcessing] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);
    const [emailDetails, setEmailDetails] = useState(null);
    const [response, setResponse] = useState(null);
    const [error, setError] = useState(null);
    const [tone, setTone] = useState("professional"); // Default tone

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!instruction.trim()) {
            toast.warning("Please enter an instruction first");
            return;
        }
        
        setProcessing(true);
        setError(null);
        setResponse(null);
        setEmailDetails(null);
        setPreviewMode(false);
        
        try {
            // Try preview endpoint first
            let res = await fetch("http://localhost:5000/agent/preview", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({ instruction, tone }), // Include tone in the request
            });
            
            // If preview endpoint fails, fallback to direct execution
            if (!res.ok) {
                console.log("Preview endpoint not available, falling back to direct execution");
                
                res = await fetch("http://localhost:5000/agent/execute", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                    body: JSON.stringify({ instruction, tone }), // Include tone in the request
                });
                
                // Check content type
                const contentType = res.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    const textResponse = await res.text();
                    console.error("Non-JSON response:", textResponse);
                    throw new Error("Server returned non-JSON response. Try restarting your server.");
                }
                
                const data = await res.json();
                
                if (!res.ok) {
                    throw new Error(data.message || "Something went wrong");
                }
                
                // Display the response directly if we used the execute endpoint
                setResponse(data);
                toast.success("Email sent successfully!");
                return;
            }
            
            // If we got here, the preview endpoint worked
            // Check content type
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const textResponse = await res.text();
                console.error("Non-JSON response:", textResponse);
                throw new Error("Server returned non-JSON response. Try restarting your server.");
            }
            
            const data = await res.json();
            
            if (data.task === "send_email" && data.emailDetails) {
                setEmailDetails(data.emailDetails);
                setPreviewMode(true);
                toast.info("Email preview generated. Review before sending.");
            } else {
                toast.error("Could not generate an email from your instructions. Please be more specific.");
                setError("Could not generate an email from your instructions. Please be more specific.");
            }
        } catch (err) {
            console.error("Error processing instruction:", err);
            toast.error(err.message || "Failed to process instruction");
            setError(err.message || "Failed to process instruction");
        } finally {
            setProcessing(false);
        }
    };

    const handleSendEmail = async () => {
        if (!emailDetails) {
            toast.warning("No email details available");
            return;
        }
        
        setProcessing(true);
        setError(null);
        setResponse(null);
        
        try {
            const res = await fetch("http://localhost:5000/agent/send-email", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({ ...emailDetails, tone: emailDetails.tone || tone }),
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.message || "Failed to send email");
            }
            
            setResponse(data);
            setPreviewMode(false);
            toast.success("Email sent successfully!");
            // Keep the emailDetails to show what was sent
        } catch (err) {
            console.error("Error sending email:", err);
            toast.error(err.message || "Failed to send email");
            setError(err.message || "Failed to send email");
        } finally {
            setProcessing(false);
        }
    };

    const handleEdit = (field, value) => {
        if (!emailDetails) return;
        
        setEmailDetails({
            ...emailDetails,
            [field]: value
        });
    };

    const handleCancel = () => {
        setPreviewMode(false);
        setEmailDetails(null);
        toast.info("Email preview cancelled");
    };

    // Function to safely render email content
    const renderEmailContent = (content) => {
        if (!content) return null;
        
        // Check if the content is a string
        if (typeof content !== 'string') {
            try {
                // If it's an object, stringify it
                return JSON.stringify(content, null, 2);
            } catch (e) {
                return "Error displaying content";
            }
        }
        
        return content;
    };

    return (
        <div className="ai-agent-container" style={{ marginTop: "30px", padding: "20px", border: "1px solid #ddd", borderRadius: "8px" }}>
            <ToastContainer 
                position="top-right" 
                autoClose={3000} 
                hideProgressBar={false} 
                newestOnTop 
                closeOnClick 
                rtl={false} 
                pauseOnFocusLoss={false} 
                draggable 
                pauseOnHover 
                theme="light"
                limit={3}
            />
            
            <h3>AI Email Assistant</h3>
            
            {!previewMode && !response && (
                <>
                    <p>Tell me what you want me to do. For example: "Send an email to john@example.com about the project status update"</p>
                    
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: "15px" }}>
                            <textarea
                                value={instruction}
                                onChange={(e) => setInstruction(e.target.value)}
                                placeholder="Enter your instructions here..."
                                style={{ 
                                    width: "100%", 
                                    minHeight: "100px", 
                                    padding: "10px",
                                    borderRadius: "4px",
                                    border: "1px solid #ccc"
                                }}
                            />
                        </div>
                        
                        <div style={{ marginBottom: "15px", display: "flex", alignItems: "center" }}>
                            <label style={{ marginRight: "10px" }}>Email Tone:</label>
                            <select 
                                value={tone} 
                                onChange={(e) => setTone(e.target.value)}
                                style={{ 
                                    padding: "8px", 
                                    borderRadius: "4px",
                                    border: "1px solid #ccc" 
                                }}
                            >
                                <option value="professional">Professional</option>
                                <option value="casual">Casual</option>
                                <option value="friendly">Friendly</option>
                            </select>
                        </div>
                        
                        <button
                            type="submit"
                            disabled={processing}
                            style={{
                                backgroundColor: "#4285F4",
                                color: "white",
                                padding: "10px 15px",
                                border: "none",
                                borderRadius: "4px",
                                cursor: processing ? "not-allowed" : "pointer",
                                opacity: processing ? 0.7 : 1
                            }}
                        >
                            {processing ? "Processing..." : "Generate Email"}
                        </button>
                    </form>
                </>
            )}
            
            {previewMode && emailDetails && (
                <div>
                    <h4>Preview Email</h4>
                    <p>Review the email below before sending:</p>
                    
                    <div style={{ 
                        marginTop: "15px",
                        marginBottom: "20px",
                        backgroundColor: "#fff",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        padding: "15px"
                    }}>
                        <div style={{ marginBottom: "10px" }}>
                            <label style={{ display: "block", fontWeight: "bold", marginBottom: "5px" }}>To:</label>
                            <input 
                                type="text" 
                                value={emailDetails.to || ""} 
                                onChange={(e) => handleEdit("to", e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "8px",
                                    borderRadius: "4px",
                                    border: "1px solid #ddd"
                                }}
                            />
                        </div>
                        
                        <div style={{ marginBottom: "10px" }}>
                            <label style={{ display: "block", fontWeight: "bold", marginBottom: "5px" }}>Subject:</label>
                            <input 
                                type="text" 
                                value={emailDetails.subject || ""} 
                                onChange={(e) => handleEdit("subject", e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "8px",
                                    borderRadius: "4px",
                                    border: "1px solid #ddd"
                                }}
                            />
                        </div>
                        
                        <div style={{ marginBottom: "10px" }}>
                            <label style={{ display: "block", fontWeight: "bold", marginBottom: "5px" }}>Tone:</label>
                            <select 
                                value={emailDetails.tone || tone} 
                                onChange={(e) => handleEdit("tone", e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "8px",
                                    borderRadius: "4px",
                                    border: "1px solid #ddd"
                                }}
                            >
                                <option value="professional">Professional</option>
                                <option value="casual">Casual</option>
                                <option value="friendly">Friendly</option>
                            </select>
                        </div>
                        
                        <div style={{ marginBottom: "15px" }}>
                            <label style={{ display: "block", fontWeight: "bold", marginBottom: "5px" }}>Content:</label>
                            <textarea 
                                value={emailDetails.content || ""} 
                                onChange={(e) => handleEdit("content", e.target.value)}
                                style={{
                                    width: "100%",
                                    minHeight: "200px",
                                    padding: "8px",
                                    borderRadius: "4px",
                                    border: "1px solid #ddd",
                                    fontFamily: "Arial, sans-serif",
                                    lineHeight: "1.5",
                                }}
                            />
                        </div>
                        
                        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                            <button
                                onClick={handleCancel}
                                style={{
                                    backgroundColor: "#f5f5f5",
                                    color: "#333",
                                    padding: "8px 15px",
                                    border: "1px solid #ddd",
                                    borderRadius: "4px",
                                    cursor: "pointer"
                                }}
                            >
                                Cancel
                            </button>
                            
                            <button
                                onClick={handleSendEmail}
                                disabled={processing}
                                style={{
                                    backgroundColor: "#4CAF50",
                                    color: "white",
                                    padding: "8px 15px",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: processing ? "not-allowed" : "pointer",
                                    opacity: processing ? 0.7 : 1
                                }}
                            >
                                {processing ? "Sending..." : "Send Email"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {error && (
                <div style={{ 
                    marginTop: "15px", 
                    padding: "10px", 
                    backgroundColor: "#FFEBEE", 
                    color: "#D32F2F",
                    borderRadius: "4px" 
                }}>
                    {error}
                </div>
            )}
            
            {response && (
                <div style={{ 
                    marginTop: "15px", 
                    padding: "15px", 
                    backgroundColor: "#E8F5E9", 
                    borderRadius: "4px" 
                }}>
                    <h4>Email Sent Successfully!</h4>
                    <p>{response.message || "Your email has been sent."}</p>
                    
                    <div style={{ 
                        marginTop: "15px",
                        backgroundColor: "#fff",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        padding: "15px"
                    }}>
                        <h5 style={{ marginTop: 0 }}>Email Details:</h5>
                        <p><strong>To:</strong> {emailDetails?.to || response.to || "N/A"}</p>
                        <p><strong>Subject:</strong> {emailDetails?.subject || response.subject || "N/A"}</p>
                        <p style={{ marginBottom: "5px" }}><strong>Content:</strong></p>
                        <div style={{ 
                            backgroundColor: "#f8f9fa", 
                            padding: "10px",
                            borderRadius: "4px",
                            border: "1px solid #e9ecef",
                            whiteSpace: "pre-wrap",
                            fontFamily: "Arial, sans-serif",
                            fontSize: "0.9rem",
                            lineHeight: "1.5",
                            maxHeight: "300px",
                            overflowY: "auto"
                        }}>
                            {renderEmailContent(emailDetails?.content || response.content)}
                        </div>
                    </div>
                    
                    <button
                        onClick={() => {
                            setResponse(null);
                            setEmailDetails(null);
                            setInstruction("");
                            toast.info("Ready to create a new email");
                        }}
                        style={{
                            backgroundColor: "#4285F4",
                            color: "white", 
                            padding: "8px 15px",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            marginTop: "15px"
                        }}
                    >
                        Create Another Email
                    </button>
                </div>
            )}
        </div>
    );
};

export default AIAgent;