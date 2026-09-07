import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, apiErrorMessage } from "../api/client";

interface StudentRow {
  id: string;
  registerNumber: string;
  name: string;
  email: string;
}

export default function ClassPage() {
  const { classId } = useParams();
  const [className, setClassName] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [bulkText, setBulkText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const { data } = await api.get(`/classes/${classId}`);
    setClassName(data.name);
    setStudents(data.students);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function handleAddStudents(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    // Expected format, one per line: "Register Number, Name, email@example.com"
    const rows = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [registerNumber, name, email] = line.split(",").map((s) => s.trim());
        return { registerNumber, name, email };
      });

    if (rows.some((r) => !r.name || !r.email)) {
      setError('Each line must be "Register Number, Name, email@example.com".');
      return;
    }

    try {
      await api.post(`/classes/${classId}/students`, { students: rows });
      setBulkText("");
      setMessage(`Added ${rows.length} student(s).`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function removeStudent(studentId: string) {
    if (!confirm("Remove this student from the class?")) return;
    await api.delete(`/classes/${classId}/students/${studentId}`);
    load();
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-slate-900">{className}</h1>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-medium text-slate-900 mb-2">Add students</h2>
        <p className="text-sm text-slate-500 mb-3">
          One per line: <code className="bg-slate-100 px-1 rounded">Register Number, Name, email@example.com</code>
        </p>
        <form onSubmit={handleAddStudents} className="space-y-3">
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={5}
            placeholder={"1, Aisha Khan, aisha@example.com\n2, Rahul Verma, rahul@example.com"}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-600">{message}</p>}
          <button className="bg-slate-900 text-white text-sm font-medium rounded-lg px-4 py-2">Add students</button>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        <div className="px-4 py-3 text-sm font-medium text-slate-500">{students.length} registered students</div>
        {students.map((s) => (
          <div key={s.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-slate-900 text-sm">{s.registerNumber} · {s.name}</div>
              <div className="text-slate-500 text-xs">{s.email}</div>
            </div>
            <button onClick={() => removeStudent(s.id)} className="text-xs text-red-600 hover:underline">
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
