import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { API_BASE, api, apiErrorMessage } from "../api/client";
import { recordDownload } from "../lib/downloadHistory";

interface PollOption {
  id: string;
  text: string;
}
interface PollData {
  id: string;
  title: string;
  topic: string;
  description?: string;
  status: "DRAFT" | "OPEN" | "LOCKED" | "CLOSED";
  allowMultipleAnswer: boolean;
  shareToken: string;
  classId: string;
  options: PollOption[];
  authorizedEmails: { email: string }[];
}
interface Results {
  totalAuthorized: number;
  totalVoted: number;
  totalNotVoted: number;
  options: { id: string; text: string; votes: number }[];
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  OPEN: "bg-green-100 text-green-700",
  LOCKED: "bg-amber-100 text-amber-700",
  CLOSED: "bg-red-100 text-red-700",
};

export default function PollDetailPage() {
  const { pollId } = useParams();
  const [poll, setPoll] = useState<PollData | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [shareInfo, setShareInfo] = useState<{ link: string; whatsappLink: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<{ id: string; registerNumber: string; name: string; email: string }[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [selectedOptionId, setSelectedOptionId] = useState("");

  async function load() {
    try {
      const { data } = await api.get(`/polls/${pollId}`);
      setPoll(data.poll);
      setSelectedOptionId(data.poll.options[0]?.id || "");
      setResults(data.results);
      setSelectedEmails(new Set(data.poll.authorizedEmails.map((a: any) => a.email)));
      const cls = await api.get(`/classes/${data.poll.classId}`);
      setStudents(cls.data.students);
      const origin = window.location.origin;
      const share = await api.get(`/polls/${pollId}/share`, { params: { origin } });
      setShareInfo(share.data);
      const qrRes = await api.get(`/polls/${pollId}/qrcode`, { params: { origin } });
      setQr(qrRes.data.dataUrl);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollId]);

  // Live results over Socket.IO
  useEffect(() => {
    if (!pollId) return;
    const socket: Socket = io(API_BASE);
    socket.emit("poll:join", pollId);
    socket.on("poll:results", (data: Results) => setResults(data));
    socket.on("poll:status", (data: { status: PollData["status"] }) => {
      setPoll((prev) => (prev ? { ...prev, status: data.status } : prev));
    });
    return () => {
      socket.emit("poll:leave", pollId);
      socket.disconnect();
    };
  }, [pollId]);

  async function setStatus(status: PollData["status"]) {
    try {
      await api.patch(`/polls/${pollId}/status`, { status });
      setPoll((prev) => (prev ? { ...prev, status } : prev));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  function toggleStudent(email: string) {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }
  function toggleSelectAll() {
    setSelectedEmails(selectedEmails.size === students.length ? new Set() : new Set(students.map((s) => s.email)));
  }

  async function saveAuthorized() {
    try {
      await api.patch(`/polls/${pollId}/authorized-emails`, { authorizedEmails: [...selectedEmails] });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  function downloadExport(type: "voted" | "not-voted") {
    const token = localStorage.getItem("teacherToken");
    fetch(`${API_BASE}/api/polls/${pollId}/export?type=${type}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not download this report.");
        return response.text();
      })
      .then((csv) => {
        const workbook = XLSX.read(csv, { type: "string" });
        const fileName = `${poll?.topic || "poll"}-${type}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        recordDownload(fileName, type === "voted" ? "Voted students" : "Not-voted students", poll?.title || "Poll");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not download this report."));
  }

  function downloadOptionWise() {
    if (!selectedOptionId) return;
    const token = localStorage.getItem("teacherToken");
    const option = poll?.options.find((item) => item.id === selectedOptionId);
    fetch(`${API_BASE}/api/polls/${pollId}/export/option-wise?optionId=${encodeURIComponent(selectedOptionId)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not download this option report.");
        return response.text();
      })
      .then((csv) => {
        const workbook = XLSX.read(csv, { type: "string" });
        const fileName = `${option?.text || "option"}-voters.xlsx`;
        XLSX.writeFile(workbook, fileName);
        recordDownload(fileName, `Voters for ${option?.text || "selected option"}`, poll?.title || "Poll");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not download this option report."));
  }

  const maxVotes = useMemo(() => Math.max(1, ...(results?.options.map((o) => o.votes) || [1])), [results]);
  const selectedOption = poll?.options.find((option) => option.id === selectedOptionId);

  if (!poll) return <p className="text-slate-500">{error || "Loading…"}</p>;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{poll.title}</h1>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[poll.status]}`}>{poll.status}</span>
        </div>
        <p className="text-sm text-slate-500 mt-1">Topic: {poll.topic}</p>
        {poll.description && <p className="text-sm text-slate-600 mt-2">{poll.description}</p>}
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>}

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setStatus("OPEN")} disabled={poll.status === "OPEN"} className="bg-green-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2">
          Open voting
        </button>
        <button onClick={() => setStatus("LOCKED")} disabled={poll.status !== "OPEN"} className="bg-amber-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2">
          Lock poll
        </button>
        <button onClick={() => setStatus("OPEN")} disabled={poll.status !== "LOCKED"} className="bg-brand-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2">
          Unlock
        </button>
        <button onClick={() => setStatus("CLOSED")} disabled={poll.status === "CLOSED"} className="bg-red-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2">
          Close poll
        </button>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-medium text-slate-900 mb-3">Share with students</h2>
        {shareInfo && (
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="flex-1 space-y-2 w-full">
              <div className="flex gap-2">
                <input readOnly value={shareInfo.link} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50" />
                <button
                  onClick={() => navigator.clipboard.writeText(shareInfo.link)}
                  className="bg-slate-900 text-white text-sm rounded-lg px-3 py-2"
                >
                  Copy
                </button>
              </div>
              <a
                href={shareInfo.whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="inline-block bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg px-4 py-2"
              >
                Share on WhatsApp
              </a>
            </div>
            {qr && <img src={qr} alt="Poll QR code" className="w-32 h-32 rounded-lg border border-slate-200" />}
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-slate-900">
            Live results — {results?.totalVoted ?? 0}/{results?.totalAuthorized ?? 0} voted
          </h2>
          <div className="flex gap-2">
            <button onClick={() => downloadExport("voted")} className="text-sm text-brand-600 font-medium">
              Export voted (Excel)
            </button>
            <button onClick={() => downloadExport("not-voted")} className="text-sm text-brand-600 font-medium">
              Export not-voted (Excel)
            </button>
            <select value={selectedOptionId} onChange={(event) => setSelectedOptionId(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
              {poll.options.map((option) => <option key={option.id} value={option.id}>{option.text}</option>)}
            </select>
            <button onClick={downloadOptionWise} className="text-sm text-brand-600 font-medium">
              Download {selectedOption?.text || "selected option"} voters (Excel)
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {results?.options.map((o) => (
            <div key={o.id}>
              <div className="flex justify-between text-sm text-slate-700 mb-1">
                <span>{o.text}</span>
                <span className="font-medium">{o.votes}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500" style={{ width: `${(o.votes / maxVotes) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium text-slate-900">
            Authorized students ({selectedEmails.size}/{students.length})
          </h2>
          <div className="flex gap-3">
            <button onClick={toggleSelectAll} className="text-sm text-brand-600 font-medium">
              {selectedEmails.size === students.length ? "Deselect all" : "Select all"}
            </button>
            <button onClick={saveAuthorized} className="text-sm bg-slate-900 text-white rounded-lg px-3 py-1.5">
              Save changes
            </button>
          </div>
        </div>
        <div className="border border-slate-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-slate-100">
          {students.map((s) => (
            <label key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={selectedEmails.has(s.email)} onChange={() => toggleStudent(s.email)} />
              <span className="text-slate-900">{s.registerNumber} · {s.name}</span>
              <span className="text-slate-400 text-xs">{s.email}</span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
