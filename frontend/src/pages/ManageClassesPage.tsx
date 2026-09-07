import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiErrorMessage } from "../api/client";

interface ClassRow { id: string; name: string; studentCount: number; }

export default function ManageClassesPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try { setClasses((await api.get("/classes")).data); }
    catch (err) { setError(apiErrorMessage(err)); }
  }

  useEffect(() => { load(); }, []);

  async function createClass(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      await api.post("/classes", { name: name.trim() });
      setName("");
      load();
    } catch (err) { setError(apiErrorMessage(err)); }
  }

  return (
    <div className="space-y-8">
      <div><h1 className="text-2xl font-semibold text-slate-900">Manage classes</h1><p className="mt-1 text-sm text-slate-500">Create classes and open a class to manage its roster.</p></div>
      {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      <form onSubmit={createClass} className="flex max-w-xl gap-2">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Class name" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Add class</button>
      </form>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((item) => <Link key={item.id} to={`/students?classId=${item.id}`} className="rounded-xl border border-slate-200 bg-white p-5 transition hover:shadow-sm"><div className="font-medium text-slate-900">{item.name}</div><div className="mt-1 text-sm text-slate-500">{item.studentCount} students</div><div className="mt-4 text-sm font-medium text-brand-600">Manage roster</div></Link>)}
        {classes.length === 0 && <p className="text-sm text-slate-500">No classes yet.</p>}
      </div>
    </div>
  );
}