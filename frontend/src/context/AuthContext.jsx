import React, { createContext, useState, useEffect, useContext } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Hydrate state from localStorage
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (savedToken && savedUser) {
      try {
        // Validate JWT token expiry
        const payload = JSON.parse(atob(savedToken.split(".")[1]));
        const isExpired = payload.exp * 1000 < Date.now();

        if (isExpired) {
          logout();
        } else {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        }
      } catch (err) {
        console.error("JWT restore error:", err);
        logout();
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const res = await api.post("/users/login", { email, password });
      const { token: receivedToken, user: receivedUser } = res.data;
      
      // Extract user_id and verify admin details from JWT payload
      const payload = JSON.parse(atob(receivedToken.split(".")[1]));
      
      const fullUser = {
        ...receivedUser,
        user_id: payload.user_id,
        role: payload.role // Could be 'Donor', 'NGO', 'Admin'
      };

      localStorage.setItem("token", receivedToken);
      localStorage.setItem("user", JSON.stringify(fullUser));
      
      setToken(receivedToken);
      setUser(fullUser);
      return fullUser;
    } catch (err) {
      throw new Error(err.response?.data?.message || "Login failed");
    }
  };

  const register = async (name, email, password, role, city) => {
    try {
      await api.post("/users/register", { name, email, password, role, city });
    } catch (err) {
      throw new Error(err.response?.data?.message || "Registration failed");
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    isAuthenticated: !!token,
    loading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
