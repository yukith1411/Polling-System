import axios from "axios";

export const API_BASE = import.meta.env.VITE_API_URL || "";

export const api = axios.create({ baseURL: `${API_BASE}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("teacherToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Separate instance for the student flow, which carries its own poll-session token
// (issued only after OTP verification) instead of the teacher's token.
export const studentApi = axios.create({ baseURL: `${API_BASE}/api/public/polls` });

export function withStudentSession(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as any;
    if (typeof data?.error === "string") return data.error;
    if (data?.error?.formErrors?.length) return data.error.formErrors.join(", ");
    return err.message;
  }
  return "Something went wrong. Please try again.";
}
