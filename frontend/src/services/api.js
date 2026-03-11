import axios from "axios";
import { API_CONFIG } from "../config/apiConfig";
import toast from "react-hot-toast";

const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Add Auth Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Global Error Handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const { response } = error;

    if (response) {
      // Global handling for specific status codes
      switch (response.status) {
        case 401:
          // Unauthorized: Clear token and redirect to login
          localStorage.removeItem("token");
          const path = window.location.pathname;
          if (!path.includes('/login') && !path.includes('/forgot-password') && !path.includes('/reset-password')) {
            window.location.href = '/login';
            toast.error("Session expired. Please login again.");
          }
          break;
        case 403:
          toast.error("You don't have permission to perform this action.");
          break;
        case 404:
          toast.error("The requested resource was not found.");
          break;
        case 500:
          toast.error("Internal Server Error. Please try again later.");
          break;
        default:
          toast.error(response.data?.message || "Something went wrong.");
      }
    } else if (error.request) {
      // Network Error
      toast.error("Network error. Please check your connection.");
    } else {
      // Something else happened
      toast.error("An unexpected error occurred.");
    }

    return Promise.reject(error);
  }
);

export default api;