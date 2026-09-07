import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiErrorMessage } from "../api/client";

interface ClassRow {
  id: string;
  name: string;
  studentCount: number;
}

interface PollRow {
  id: string;
  title: string;
  topic: string;
  status: string;
  className: string;
  totalAuthorized: number;
  totalVoted: number;
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  OPEN: "bg-green-100 text-green-700",
  LOCKED: "bg-amber-100 text-amber-700",
  CLOSED: "bg-red-100 text-red-700",
};

export default function DashboardPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [polls, setPolls] = useState<PollRow[]>([]);
  const [newClassName, setNewClassName] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [classView, setClassView] = useState<"tile" | "list">("tile");
  const [pollView, setPollView] = useState<"tile" | "list">("list");

  async function loadAll() {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        api.get("/classes"),
        api.get("/polls", { params: { topic: topicFilter || undefined, status: statusFilter || undefined } }),
      ]);
      setClasses(c.data);
      setPolls(p.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicFilter, statusFilter]);

  async function createClass(e: React.FormEvent) {
    e.preventDefault();
    if (!newClassName.trim()) return;
    try {
      await api.post("/classes", { name: newClassName.trim() });
      setNewClassName("");
      loadAll();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-10">
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>}

      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3"><h2 className="text-lg font-semibold text-slate-900">Your classes</h2><div className="flex rounded-lg border border-slate-200 bg-white p-1"><button onClick={() => setClassView("tile")} className={`rounded px-2 py-1 text-xs ${classView === "tile" ? "bg-brand-50 text-brand-700" : "text-slate-500"}`}>Tiles</button><button onClick={() => setClassView("list")} className={`rounded px-2 py-1 text-xs ${classView === "list" ? "bg-brand-50 text-brand-700" : "text-slate-500"}`}>List</button></div></div>
          <Link to="/polls/new" className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg px-4 py-2">+ New poll</Link>
        </div>

        <form onSubmit={createClass} className="flex gap-2 mb-4">
          <input
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            placeholder="New class name (e.g. Grade 10 - Section A)"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button className="bg-slate-900 text-white text-sm font-medium rounded-lg px-4 py-2">Add class</button>
        </form>

        <div className={classView === "tile" ? "grid sm:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-2"}>
          {classes.map((c) => (
            <Link
              key={c.id}
              to={`/classes/${c.id}`}
              className={`bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition ${classView === "list" ? "flex items-center justify-between" : ""}`}
            >
              <div className="font-medium text-slate-900">{c.name}</div>
              <div className="text-sm text-slate-500 mt-1">{c.studentCount} students</div>
            </Link>
          ))}
          {classes.length === 0 && !loading && (
            <p className="text-sm text-slate-500">No classes yet — add one above to get started.</p>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3"><h2 className="text-lg font-semibold text-slate-900">Polls</h2><div className="flex rounded-lg border border-slate-200 bg-white p-1"><button onClick={() => setPollView("tile")} className={`rounded px-2 py-1 text-xs ${pollView === "tile" ? "bg-brand-50 text-brand-700" : "text-slate-500"}`}>Tiles</button><button onClick={() => setPollView("list")} className={`rounded px-2 py-1 text-xs ${pollView === "list" ? "bg-brand-50 text-brand-700" : "text-slate-500"}`}>List</button></div></div>
          <div className="flex gap-2">
            <input
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              placeholder="Filter by topic…"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="OPEN">Open</option>
              <option value="LOCKED">Locked</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </div>

        <div className={pollView === "list" ? "bg-white border border-slate-200 rounded-xl divide-y divide-slate-100" : "grid gap-4 sm:grid-cols-2"}>
          {polls.map((p) => (
            <Link key={p.id} to={`/polls/${p.id}`} className={pollView === "list" ? "flex items-center justify-between px-4 py-3 hover:bg-slate-50" : "rounded-xl border border-slate-200 bg-white p-4 hover:shadow-sm transition"}>
              <div>
                <div className="font-medium text-slate-900">{p.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {p.className} · {p.topic} · {p.totalVoted}/{p.totalAuthorized} voted
                </div>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[p.status]}`}>{p.status}</span>
            </Link>
          ))}
          {polls.length === 0 && !loading && <p className="text-sm text-slate-500 px-4 py-6">No polls match yet.</p>}
        </div>
      </section>
    </div>
  );
}
