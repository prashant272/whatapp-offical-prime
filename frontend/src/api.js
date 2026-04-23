// Centralized API configuration
// In development, Vite proxies /api to the backend URL defined in .env
// In production, we can use the VITE_API_URL if defined, otherwise fallback to /api (relative)
export const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "/api";

// If you prefer to ALWAYS use the proxy in dev and ONLY use full URL in prod:
// export const API_BASE = import.meta.env.PROD ? (import.meta.env.VITE_API_URL + "/api") : "/api";

export default API_BASE;
