import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface Teacher {
  id: string;
  name: string;
  department: string;
  email: string;
  role: string;
}

interface AuthContextValue {
  teacher: Teacher | null;
  token: string | null;
  login: (token: string, teacher: Teacher) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function getStoredToken(): string | null {
  const storedToken = localStorage.getItem("teacherToken");
  const expiresAt = storedToken ? getTokenExpiry(storedToken) : null;

  if (!storedToken || expiresAt === null || expiresAt <= Date.now()) {
    localStorage.removeItem("teacherToken");
    localStorage.removeItem("teacher");
    return null;
  }

  return storedToken;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [teacher, setTeacher] = useState<Teacher | null>(() => {
    const raw = localStorage.getItem("teacher");
    return raw ? JSON.parse(raw) : null;
  });

  function login(newToken: string, newTeacher: Teacher) {
    localStorage.setItem("teacherToken", newToken);
    localStorage.setItem("teacher", JSON.stringify(newTeacher));
    setToken(newToken);
    setTeacher(newTeacher);
  }

  function logout() {
    localStorage.removeItem("teacherToken");
    localStorage.removeItem("teacher");
    setToken(null);
    setTeacher(null);
  }

  useEffect(() => {
    if (!token) return;

    const expiresAt = getTokenExpiry(token);
    const timeout = window.setTimeout(logout, expiresAt === null ? 0 : Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [token]);

  return <AuthContext.Provider value={{ teacher, token, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
