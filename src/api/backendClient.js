// Client for the self-hosted LedgerShift backend (see /backend).
// Base URL: VITE_API_URL if set; in dev, localhost:4000; in a production build
// with no VITE_API_URL, same origin (single-service Railway deploy).

const API_BASE = (
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:4000" : "")
).replace(/\/$/, "");
const TOKEN_KEY = "ledgershift_api_token";

export function getBackendToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setBackendToken(token) {
  try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch {}
}

export function isBackendAuthenticated() {
  return !!getBackendToken();
}

export class BackendError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Shared fetch wrapper: attaches the JWT and normalises error handling.
async function request(path, { method = "GET", body, formData } = {}) {
  const headers = {};
  const token = getBackendToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (formData) {
    payload = formData; // browser sets the multipart boundary
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload });
  } catch {
    throw new BackendError(0, `Cannot reach the LedgerShift backend at ${API_BASE || "this origin"}`);
  }

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }

  if (!res.ok) {
    if (res.status === 401) setBackendToken(null); // force re-login on expired token
    throw new BackendError(res.status, data?.error || `Request failed (${res.status})`, data?.details);
  }
  return data;
}

export const apiGet = (path) => request(path);
export const apiPost = (path, body) => request(path, { method: "POST", body });
export const apiPut = (path, body) => request(path, { method: "PUT", body });
export const apiDelete = (path) => request(path, { method: "DELETE" });

export function apiUpload(path, file) {
  const formData = new FormData();
  formData.append("file", file);
  return request(path, { method: "POST", formData });
}

/** Sign in against the backend and store the JWT for later calls. */
export async function backendLogin(email, password) {
  const result = await apiPost("/api/auth/login", { email, password });
  setBackendToken(result.token);
  return result.user;
}
