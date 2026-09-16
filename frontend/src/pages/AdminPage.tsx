import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../api/client";
import AdminNetwork3D from "../components/AdminNetwork3D";

interface Overview {
  counts: Record<string, number>;
  pollStatuses: Record<string, number>;
  teachers: { id: string; name: string; department: string; email: string; role: string; createdAt: string }[];
  classes: { id: string; name: string; teacher: { name: string; email: string }; _count: { enrollments: number; polls: number } }[];
  polls: { id: string; title: string; topic: string; status: string; teacher: { name: string }; class: { name: string }; _count: { votes: number; authorizedEmails: number; accessAttempts: number } }[];
}

const labels: Record<string, string> = { teachers: "Teachers", classes: "Classes", students: "Students", polls: "Polls", votes: "Votes", accessAttempts: "Access attempts" };

const statusStyles: Record<string, string> = {
  OPEN: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-slate-100 text-slate-700",
  DRAFT: "bg-amber-50 text-amber-700",
};

export default function AdminPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingTeacher, setSavingTeacher] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);

  async function loadOverview(isRefresh = false) {
    setError(null);
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const response = await api.get("/admin/overview");
      setOverview(response.data);
      setSelectedTeacherId((current) => current && response.data.teachers.some((teacher: Overview["teachers"][number]) => teacher.id === current) ? current : response.data.teachers[0]?.id ?? null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void loadOverview(); }, []);

  if (loading) return <p className="text-sm text-slate-500">Loading admin overview...</p>;
  if (error && !overview) return <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!overview) return null;

  const selectedTeacher = overview.teachers.find((teacher) => teacher.id === selectedTeacherId) ?? overview.teachers[0];
  const selectedClasses = selectedTeacher ? overview.classes.filter((item) => item.teacher.name === selectedTeacher.name) : [];
  const selectedPolls = selectedTeacher ? overview.polls.filter((poll) => poll.teacher.name === selectedTeacher.name) : [];

  async function updateTeacher(teacher: Overview["teachers"][number], form: HTMLFormElement) {
    const formData = new FormData(form);
    setSavingTeacher(teacher.id); setError(null);
    try {
      await api.patch(`/admin/teachers/${teacher.id}`, { name: formData.get("name"), department: formData.get("department"), role: formData.get("role") });
      await loadOverview(true);
    } catch (err) { setError(apiErrorMessage(err)); } finally { setSavingTeacher(null); }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-brand-600">System monitor</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Admin dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Manage staff access and monitor polling activity across the system.</p>
        </div>
        <button type="button" onClick={() => void loadOverview(true)} disabled={refreshing} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {refreshing ? "Refreshing..." : "Refresh data"}
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Object.entries(overview.counts).map(([key, value]) => (
          <div key={key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-2xl font-semibold text-slate-900">{value}</div>
            <div className="mt-1 text-xs text-slate-500">{labels[key] ?? key}</div>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#081426] shadow-lg">
        <div className="flex flex-col gap-3 border-b border-slate-700 px-5 py-4 text-white sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Live topology</p>
            <h2 className="mt-1 text-xl font-semibold">Teachers and classes</h2>
            <p className="mt-1 text-sm text-slate-300">Drag to orbit, scroll to zoom, or select a teacher node.</p>
          </div>
          <div className="flex gap-4 text-xs text-slate-300"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-sky-400" />Teacher</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-orange-500" />Class</span></div>
        </div>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_260px]">
          <AdminNetwork3D teachers={overview.teachers} classes={overview.classes} selectedTeacherId={selectedTeacher?.id ?? null} onSelectTeacher={setSelectedTeacherId} />
          <aside className="border-t border-slate-700 bg-slate-900/70 p-5 text-white lg:border-l lg:border-t-0">
            {selectedTeacher ? <><p className="text-xs uppercase tracking-wide text-slate-400">Selected teacher</p><h3 className="mt-2 text-lg font-semibold">{selectedTeacher.name}</h3><p className="mt-1 break-all text-sm text-cyan-200">{selectedTeacher.email}</p><p className="mt-1 text-sm text-slate-300">{selectedTeacher.department || "No department"} · {selectedTeacher.role}</p><div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-lg bg-slate-800 p-3"><div className="text-xl font-semibold">{selectedClasses.length}</div><div className="text-xs text-slate-400">Classes</div></div><div className="rounded-lg bg-slate-800 p-3"><div className="text-xl font-semibold">{selectedPolls.length}</div><div className="text-xs text-slate-400">Polls</div></div></div><div className="mt-5 space-y-2">{selectedClasses.length ? selectedClasses.map((item) => <div key={item.id} className="border-b border-slate-700 pb-2 text-sm"><div className="font-medium">{item.name}</div><div className="text-xs text-slate-400">{item._count.enrollments} students · {item._count.polls} polls</div></div>) : <p className="text-sm text-slate-400">No classes assigned.</p>}</div></> : <p className="text-sm text-slate-400">No teacher data available.</p>}
          </aside>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Poll status</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(overview.pollStatuses).map(([status, count]) => <div key={status} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[status] ?? "bg-slate-100 text-slate-700"}`}>{status}</div><div className="mt-3 text-2xl font-semibold text-slate-900">{count}</div><div className="text-xs text-slate-500">polls</div></div>)}
          {Object.keys(overview.pollStatuses).length === 0 && <p className="text-sm text-slate-500">No polls have been created yet.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Teachers</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{overview.teachers.map((teacher) => <tr key={teacher.id}><td className="px-4 py-3"><input name="name" form={`teacher-${teacher.id}`} defaultValue={teacher.name} className="w-36 rounded border border-slate-300 px-2 py-1" /></td><td className="px-4 py-3"><input name="department" form={`teacher-${teacher.id}`} defaultValue={teacher.department} placeholder="Department" className="w-40 rounded border border-slate-300 px-2 py-1" /></td><td className="px-4 py-3 text-slate-600">{teacher.email}</td><td className="px-4 py-3"><select name="role" form={`teacher-${teacher.id}`} defaultValue={teacher.role} className="rounded border border-slate-300 bg-white px-2 py-1"><option value="TEACHER">Teacher</option><option value="ADMIN">Admin</option></select></td><td className="px-4 py-3 text-slate-500">{new Date(teacher.createdAt).toLocaleDateString()}</td><td className="px-4 py-3"><form id={`teacher-${teacher.id}`} onSubmit={(event) => { event.preventDefault(); updateTeacher(teacher, event.currentTarget); }} /><button form={`teacher-${teacher.id}`} disabled={savingTeacher === teacher.id} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{savingTeacher === teacher.id ? "Saving..." : "Save"}</button></td></tr>)}</tbody></table>
        </div>
        {overview.teachers.length === 0 && <p className="mt-3 text-sm text-slate-500">No teacher accounts found.</p>}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">All polls</h2>
        <div className="space-y-2">{overview.polls.map((poll) => <div key={poll.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div><div className="font-medium text-slate-900">{poll.title}</div><div className="text-xs text-slate-500">{poll.teacher.name} · {poll.class.name} · {poll.topic}</div></div><div className="flex items-center gap-3 text-xs text-slate-600"><span className={`rounded-full px-2.5 py-1 font-semibold ${statusStyles[poll.status] ?? "bg-slate-100 text-slate-700"}`}>{poll.status}</span><span>{poll._count.votes}/{poll._count.authorizedEmails} voted</span><span>{poll._count.accessAttempts} attempts</span></div></div>)}</div>
        {overview.polls.length === 0 && <p className="text-sm text-slate-500">No polls have been created yet.</p>}
      </section>
    </div>
  );
}