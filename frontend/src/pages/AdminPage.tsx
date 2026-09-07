import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../api/client";

interface Overview {
  counts: Record<string, number>;
  pollStatuses: Record<string, number>;
  teachers: { id: string; name: string; department: string; email: string; role: string; createdAt: string }[];
  classes: { id: string; name: string; teacher: { name: string; email: string }; _count: { enrollments: number; polls: number } }[];
  polls: { id: string; title: string; topic: string; status: string; teacher: { name: string }; class: { name: string }; _count: { votes: number; authorizedEmails: number; accessAttempts: number } }[];
}

const labels: Record<string, string> = { teachers: "Teachers", classes: "Classes", students: "Students", polls: "Polls", votes: "Votes", accessAttempts: "Access attempts" };

export default function AdminPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingTeacher, setSavingTeacher] = useState<string | null>(null);

  useEffect(() => {
    api.get("/admin/overview").then((response) => setOverview(response.data)).catch((err) => setError(apiErrorMessage(err)));
  }, []);

  if (error) return <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!overview) return <p className="text-sm text-slate-500">Loading admin overview...</p>;

  async function updateTeacher(teacher: Overview["teachers"][number], form: HTMLFormElement) {
    const formData = new FormData(form);
    setSavingTeacher(teacher.id); setError(null);
    try {
      await api.patch(`/admin/teachers/${teacher.id}`, { name: formData.get("name"), department: formData.get("department"), role: formData.get("role") });
      const response = await api.get("/admin/overview");
      setOverview(response.data);
    } catch (err) { setError(apiErrorMessage(err)); } finally { setSavingTeacher(null); }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand-600">System monitor</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">All activity</h1>
        <p className="mt-1 text-sm text-slate-500">A read-only view of every teacher, class, poll, and voting signal.</p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Object.entries(overview.counts).map(([key, value]) => (
          <div key={key} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-2xl font-semibold text-slate-900">{value}</div>
            <div className="mt-1 text-xs text-slate-500">{labels[key] ?? key}</div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Poll status</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(overview.pollStatuses).map(([status, count]) => <span key={status} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{status}: {count}</span>)}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Teachers</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{overview.teachers.map((teacher) => <tr key={teacher.id}><td className="px-4 py-3"><input name="name" form={`teacher-${teacher.id}`} defaultValue={teacher.name} className="w-36 rounded border border-slate-300 px-2 py-1" /></td><td className="px-4 py-3"><input name="department" form={`teacher-${teacher.id}`} defaultValue={teacher.department} placeholder="Department" className="w-40 rounded border border-slate-300 px-2 py-1" /></td><td className="px-4 py-3 text-slate-600">{teacher.email}</td><td className="px-4 py-3"><select name="role" form={`teacher-${teacher.id}`} defaultValue={teacher.role} className="rounded border border-slate-300 bg-white px-2 py-1"><option value="TEACHER">Teacher</option><option value="ADMIN">Admin</option></select></td><td className="px-4 py-3 text-slate-500">{new Date(teacher.createdAt).toLocaleDateString()}</td><td className="px-4 py-3"><form id={`teacher-${teacher.id}`} onSubmit={(event) => { event.preventDefault(); updateTeacher(teacher, event.currentTarget); }} /><button form={`teacher-${teacher.id}`} disabled={savingTeacher === teacher.id} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{savingTeacher === teacher.id ? "Saving..." : "Save"}</button></td></tr>)}</tbody></table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">All polls</h2>
        <div className="space-y-2">{overview.polls.map((poll) => <div key={poll.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-medium text-slate-900">{poll.title}</div><div className="text-xs text-slate-500">{poll.teacher.name} · {poll.class.name} · {poll.topic}</div></div><div className="text-xs text-slate-600">{poll.status} · {poll._count.votes}/{poll._count.authorizedEmails} voted · {poll._count.accessAttempts} attempts</div></div>)}</div>
      </section>
    </div>
  );
}