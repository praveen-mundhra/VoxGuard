const configuredApi = import.meta.env.VITE_API_BASE?.trim();
const developmentApi = "http://localhost:8000";

const configuredOrSameOrigin = configuredApi || (
  import.meta.env.PROD ? window.location.origin : developmentApi
);

export const API_BASE = configuredOrSameOrigin
  .replace(/^http:/i, import.meta.env.PROD ? "https:" : "http:")
  .replace(/\/$/, "");

export const WS_BASE = API_BASE.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:");

export const authHeaders = () => {
  const token = window.localStorage.getItem("voxguard_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};