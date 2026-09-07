import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, apiErrorMessage } from "../api/client";

interface ClassRow {
  id: string;
  name: string;
}
interface StudentRow {
  id: string;
  registerNumber: string;
  name: string;
  email: string;
}

export default function CreatePollPage() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [allowMultipleAnswer, setAllowMultipleAnswer] = useState(false);
  const [allowVoteChange, setAllowVoteChange] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/classes").then((r) => {
      setClasses(r.data);
      if (r.data[0]) setClassId(r.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!classId) return;
    api.get(`/classes/${classId}`).then((r) => {
      setStudents(r.data.students);
      setSelectedEmails(new Set()); // reset selection when switching class
    });
  }, [classId]);

  function toggleStudent(email: string) {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedEmails.size === students.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(students.map((s) => s.email)));
    }
  }

  function updateOption(i: number, value: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  }
  function addOption() {
    setOptions((prev) => [...prev, ""]);
  }
  function removeOption(i: number) {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      setError("Add at least two poll options.");
      return;
    }
    if (selectedEmails.size === 0) {
      setError("Select at least one student to authorize.");
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post("/polls", {
        title,
        topic,
        description: description || undefined,
        classId,
        options: cleanOptions,
        allowMultipleAnswer,
        allowVoteChange,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        authorizedEmails: [...selectedEmails],
      });
      navigate(`/polls/${data.id}`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Create a poll</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Topic</label>
            <input
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Chapter 4 Quiz"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Poll title / question</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Options</label>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                {options.length > 2 && (
                  <button type="button" onClick={() => removeOption(i)} className="text-red-500 text-sm px-2">
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addOption} className="text-brand-600 text-sm mt-2 font-medium">
            + Add option
          </button>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={allowMultipleAnswer} onChange={(e) => setAllowMultipleAnswer(e.target.checked)} />
            Allow selecting multiple options
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={allowVoteChange} onChange={(e) => setAllowVoteChange(e.target.checked)} />
            Allow students to change their vote
          </label>
          <div>
            <label className="text-sm text-slate-700 mr-2">Expires:</label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700">
              Authorize students ({selectedEmails.size}/{students.length} selected)
            </label>
            <button type="button" onClick={toggleSelectAll} className="text-sm text-brand-600 font-medium">
              {selectedEmails.size === students.length && students.length > 0 ? "Deselect all" : "Select all"}
            </button>
          </div>
          <div className="border border-slate-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-slate-100">
            {students.map((s) => (
              <label key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedEmails.has(s.email)}
                  onChange={() => toggleStudent(s.email)}
                />
                <span className="text-slate-900">{s.registerNumber} · {s.name}</span>
                <span className="text-slate-400 text-xs">{s.email}</span>
              </label>
            ))}
            {students.length === 0 && <p className="text-sm text-slate-500 px-3 py-4">This class has no students yet.</p>}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          disabled={submitting}
          className="bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg px-5 py-2.5 disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create poll"}
        </button>
      </form>
    </div>
  );
}
