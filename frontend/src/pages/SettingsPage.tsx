import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api, apiErrorMessage } from "../api/client";

export default function SettingsPage() {
  const { teacher } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem("portalTheme") || "light");
  const [name, setName] = useState(teacher?.name || "");
  const [department, setDepartment] = useState(teacher?.department || "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("theme-dark", theme === "dark");
    localStorage.setItem("portalTheme", theme);
    window.dispatchEvent(new Event("portal-theme-change"));
  }, [theme]);

  async function savePersonalDetails(event: React.FormEvent) {
    event.preventDefault(); setError(null); setMessage(null);
    try {
      const response = await api.patch("/auth/me", { name, department });
      localStorage.setItem("teacher", JSON.stringify(response.data.teacher));
      localStorage.setItem("teacherToken", response.data.token);
      setMessage("Personal details updated.");
      window.location.reload();
    } catch (err) { setError(apiErrorMessage(err)); }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div><h1 className="text-2xl font-semibold text-slate-900">Settings</h1><p className="mt-1 text-sm text-slate-500">Manage your portal preferences.</p></div>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-medium text-slate-900">Personal details</h2>
        <form onSubmit={savePersonalDetails} className="mt-4 space-y-4"><label className="block text-sm text-slate-700">Name<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="block text-sm text-slate-700">Department<input required value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="e.g. Computer Science" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><div className="text-sm text-slate-500">Email: {teacher?.email} · Role: {teacher?.role}</div>{error && <p className="text-sm text-red-600">{error}</p>}{message && <p className="text-sm text-green-600">{message}</p>}<button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">Save personal details</button></form>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-medium text-slate-900">Appearance</h2>
        <label className="mt-4 flex max-w-sm items-center justify-between gap-4 text-sm text-slate-700">Theme<select value={theme} onChange={(event) => setTheme(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="light">Light</option><option value="dark">Dark</option></select></label>
      </section>
    </div>
  );
}