import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import Navbar from "./Navbar";

export default function ProtectedRoute() {
  const { token, teacher, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  if (!token) return <Navigate to="/login" replace />;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition ${
      isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className={`hidden shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col transition-all ${collapsed ? "w-20" : "w-64"}`}>
        <div className={`flex items-start border-b border-slate-200 py-5 ${collapsed ? "flex-col gap-3 px-2" : "justify-between px-5"}`}>
          <div><NavLink to="/dashboard" className="text-lg font-semibold text-slate-900">{collapsed ? "📊" : "Polling System"}</NavLink>{!collapsed && <p className="mt-1 text-xs text-slate-500">Teacher portal</p>}</div>
          <button onClick={() => setCollapsed((value) => !value)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Toggle menu" title="Toggle menu">☰</button>
        </div>
        <nav className={`flex-1 space-y-1 py-5 ${collapsed ? "px-2" : "px-3"}`}>
          <NavLink title="Dashboard" to="/dashboard" className={linkClass}><span>⌂</span>{!collapsed && <span className="ml-2">Dashboard</span>}</NavLink>
          <NavLink title="Manage classes" to="/classes" className={linkClass}><span>▦</span>{!collapsed && <span className="ml-2">Manage classes</span>}</NavLink>
          <NavLink title="Manage students" to="/students" className={linkClass}><span>♙</span>{!collapsed && <span className="ml-2">Manage students</span>}</NavLink>
          <NavLink title="Polling history" to="/poll-history" className={linkClass}><span>◷</span>{!collapsed && <span className="ml-2">Polling history</span>}</NavLink>
          <NavLink title="Downloaded history" to="/download-history" className={linkClass}><span>⇩</span>{!collapsed && <span className="ml-2">Downloaded history</span>}</NavLink>
          <NavLink title="New poll" to="/polls/new" className={linkClass}><span>＋</span>{!collapsed && <span className="ml-2">New poll</span>}</NavLink>
          {teacher?.role === "ADMIN" && <NavLink title="Admin monitor" to="/admin" className={linkClass}><span>▣</span>{!collapsed && <span className="ml-2">Admin monitor</span>}</NavLink>}
        </nav>
        <div className={`pb-8 ${collapsed ? "px-2" : "px-5"}`}><NavLink to="/settings" aria-label="Settings" title="Settings" className={linkClass}><span>⚙</span>{!collapsed && <span className="ml-2">Settings</span>}</NavLink></div>
        <div className={`border-t border-slate-200 py-4 ${collapsed ? "px-2" : "px-5"}`}>{!collapsed && <div className="mb-3 truncate text-xs text-slate-500">{teacher?.email}</div>}<button onClick={() => { logout(); navigate("/login"); }} title="Sign out" className="flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"><span>⇥</span>{!collapsed && <span className="ml-2">Sign out</span>}</button></div>
      </aside>
      <div className="min-w-0 flex-1">
        <Navbar />
        <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
          <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>
          <NavLink to="/classes" className={linkClass}>Classes</NavLink>
          <NavLink to="/students" className={linkClass}>Students</NavLink>
          <NavLink to="/poll-history" className={linkClass}>History</NavLink>
          <NavLink to="/download-history" className={linkClass}>Downloads</NavLink>
          <NavLink to="/settings" className={linkClass}><span aria-hidden="true" className="mr-2 text-sm">⚙</span>Settings</NavLink>
          <NavLink to="/polls/new" className={linkClass}>New poll</NavLink>
          {teacher?.role === "ADMIN" && <NavLink to="/admin" className={linkClass}>Admin monitor</NavLink>}
        </nav>
        <main className="mx-auto max-w-6xl px-4 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
