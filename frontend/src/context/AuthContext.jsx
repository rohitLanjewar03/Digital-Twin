import { createContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Function to handle logout
    const logout = async () => {
        try {
            await fetch("http://localhost:5000/auth/logout", { 
                credentials: "include" 
            });
        } catch (err) {
            console.error("Error logging out:", err);
        } finally {
            // Always clear localStorage and state regardless of server response
            localStorage.removeItem("user");
            setUser(null);
            navigate("/login");
        }
    };

    // Function to check token validity with the server
    const validateSession = async () => {
        try {
            const response = await fetch("http://localhost:5000/auth/validate-session", {
                credentials: "include"
            });
            
            if (!response.ok) {
                // If session is invalid, clear localStorage and state
                localStorage.removeItem("user");
                setUser(null);
                return false;
            }
            
            return true;
        } catch (error) {
            console.error("Error validating session:", error);
            return false;
        }
    };

    useEffect(() => {
        const fetchUser = async () => {
            // First check localStorage
            const storedUser = localStorage.getItem("user");
            
            if (storedUser) {
                try {
                    // Parse the stored user
                    const parsedUser = JSON.parse(storedUser);
                    setUser(parsedUser);
                    
                    // Validate the session with the server
                    const isValid = await validateSession();
                    if (!isValid) {
                        // If session is invalid, redirect to login
                        navigate("/login");
                    }
                } catch (e) {
                    console.error("Error parsing stored user:", e);
                    localStorage.removeItem("user");
                }
                setLoading(false);
                return;
            }

            // If no valid stored user, fetch from API
            try {
                console.log("Fetching user data...");
                const response = await fetch("http://localhost:5000/auth/me", { credentials: "include" });
                console.log("Response status:", response.status);
    
                if (!response.ok) {
                    throw new Error(`Failed to fetch user data: ${response.statusText}`);
                }
    
                const data = await response.json();
                console.log("User data:", data);
                setUser(data);
                // Store in localStorage
                localStorage.setItem("user", JSON.stringify(data));
            } catch (err) {
                console.error("Error fetching user:", err);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };
    
        fetchUser();
    }, [navigate]);

    return (
        <AuthContext.Provider value={{ user, loading, logout, validateSession }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;