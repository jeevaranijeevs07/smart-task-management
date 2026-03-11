import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { API_ENDPOINTS } from '../config/apiConfig';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [theme, setTheme] = useState('dark');

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setIsLoading(false);
                return;
            }

            try {
                const response = await api.get(API_ENDPOINTS.AUTH.ME);
                setUser(response.data);
            } catch (error) {
                console.error("Auth check failed:", error);
                localStorage.removeItem('token');
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();
    }, []);

    useEffect(() => {
        if (!isLoading) {
            const savedTheme = user ? (localStorage.getItem(`smarttask_theme_${user.id}`) || 'dark') : 'dark';
            setTheme(savedTheme);
            document.documentElement.setAttribute('data-theme', savedTheme);
        }
    }, [user, isLoading]);

    const changeTheme = (newTheme) => {
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        if (user) {
            localStorage.setItem(`smarttask_theme_${user.id}`, newTheme);
        }
    };

    const login = async (email, password, inviteToken = null) => {
        try {
            const response = await api.post(API_ENDPOINTS.AUTH.LOGIN, { email, password });
            const { token, user: userData } = response.data;
            localStorage.setItem('token', token);
            setUser(userData);
            if (inviteToken) {
                try {
                    await api.post(API_ENDPOINTS.INVITATIONS.ACCEPT, null, {
                        params: { token: inviteToken },
                    });
                    toast.success("Workspace invitation accepted.");
                } catch (inviteError) {
                    const inviteMessage = inviteError.response?.data?.message || "Could not accept invitation automatically.";
                    toast.error(inviteMessage);
                }
            }
            const displayName = (userData?.name || "").trim() || "User";
            const firstLoginKey = userData?.id != null
                ? `smarttask_has_logged_in_${userData.id}`
                : `smarttask_has_logged_in_${String(email || "").trim().toLowerCase()}`;
            const hasLoggedInBefore = localStorage.getItem(firstLoginKey) === "1";

            toast.success(`${hasLoggedInBefore ? "Welcome back" : "Welcome"}, ${displayName}!`);
            localStorage.setItem(firstLoginKey, "1");
            return { success: true };
        } catch (error) {
            const message = error.response?.data?.message || "Invalid credentials. Please try again.";
            toast.error(message);
            return { success: false, error: message };
        }
    };

    const register = async (userData) => {
        try {
            await api.post(API_ENDPOINTS.AUTH.REGISTER, userData);
            toast.success("Account created successfully! Please login.");
            return { success: true };
        } catch (error) {
            const message = error.response?.data?.message || "Registration failed. Please try again.";
            toast.error(message);
            return { success: false, error: message };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
        toast.success("Logged out successfully.");
    };

    const updateProfile = async (profileData) => {
        try {
            const response = await api.put(API_ENDPOINTS.AUTH.UPDATE_PROFILE, profileData);
            setUser(response.data);
            toast.success("Profile updated successfully.");
            return { success: true, user: response.data };
        } catch (error) {
            const message = error.response?.data?.message || "Failed to update profile.";
            return { success: false, error: message };
        }
    };

    const deleteAccount = async () => {
        try {
            await api.delete(API_ENDPOINTS.AUTH.DELETE_ACCOUNT);
            localStorage.removeItem('token');
            setUser(null);
            toast.success("Account deleted successfully.");
            return { success: true };
        } catch (error) {
            const message = error.response?.data?.message || "Failed to delete account.";
            return { success: false, error: message };
        }
    };

    return (
        <AuthContext.Provider value={{
            user, setUser, login, logout, register, updateProfile,
            deleteAccount, isLoading, isAuthenticated: !!user,
            theme, changeTheme
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
