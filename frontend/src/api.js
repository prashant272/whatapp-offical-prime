import axios from "axios";

export const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "/api";

const api = axios.create({
  baseURL: API_BASE
});

// Interceptor to add Auth and Account headers
api.interceptors.request.use((config) => {
  // Get token from userInfo object in localStorage
  const userInfo = localStorage.getItem("userInfo");
  if (userInfo) {
    const parsed = JSON.parse(userInfo);
    if (parsed.token) {
      config.headers.Authorization = `Bearer ${parsed.token}`;
    }
  }
  
  const accountId = localStorage.getItem("whatsappAccountId");
  // Only set if not already present to allow overrides in specific components
  if (accountId && !config.headers["x-whatsapp-account-id"]) {
    config.headers["x-whatsapp-account-id"] = accountId;
  }
  
  return config;
});

export default api;
