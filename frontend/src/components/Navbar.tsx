import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { teacher, logout } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => localStorage.getItem("portalTheme") === "dark");

  function applyTheme(isDark: boolean) {
    setDark(isDark);
    localStorage.setItem("portalTheme", isDark ? "dark" : "light");
    document.documentElement.classList.toggle("theme-dark", isDark);
    window.dispatchEvent(new Event("portal-theme-change"));
  }

  useEffect(() => {
    applyTheme(dark);
    const syncTheme = () => setDark(localStorage.getItem("portalTheme") === "dark");
    window.addEventListener("portal-theme-change", syncTheme);
    return () => window.removeEventListener("portal-theme-change", syncTheme);
  }, []);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-3"><Link to="/dashboard" className="font-semibold text-slate-900 text-lg">📊 Polling System</Link></div>
        {teacher && (
          <div className="flex items-center gap-3">
            <Link to="/settings" className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-50"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-xs font-semibold text-white">{teacher.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><span className="hidden text-right sm:block"><span className="block text-sm font-medium text-slate-800">{teacher.name}</span><span className="block text-xs text-slate-500">{teacher.department || teacher.email}</span></span></Link>
            <button onClick={() => applyTheme(!dark)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50" aria-label="Change theme">
              {dark ? "Light" : "Dark"}
            </button>
            <button aria-label="Sign out" title="Sign out"
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              ⇥
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
