import { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import { Document, Paragraph, Packer } from "docx";
import * as XLSX from "xlsx";
import { api, apiErrorMessage, API_BASE } from "../api/client";
import { recordDownload } from "../lib/downloadHistory";

interface PollRow {
  id: string;
  title: string;
  topic: string;
  status: string;
  className: string;
  totalAuthorized: number;
  totalVoted: number;
  createdAt: string;
  expiresAt?: string;
  options: { id: string; text: string }[];
}
type ReportFormat = "csv" | "xlsx" | "docx" | "pdf";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  OPEN: "bg-green-100 text-green-700",
  LOCKED: "bg-amber-100 text-amber-700",
  CLOSED: "bg-red-100 text-red-700",
};

function downloadCsv(url: string, filename: string) {
  const token = localStorage.getItem("teacherToken");
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(async (response) => { if (!response.ok) throw new Error("Could not download this report."); return response.blob(); })
    .then((blob) => { const objectUrl = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = objectUrl; anchor.download = filename; anchor.click(); URL.revokeObjectURL(objectUrl); recordDownload(filename, "Polling report", filename.replace(/-(voted|not-voted)\.csv$/, "")); })
    .catch(() => undefined);
}

export default function PollHistoryPage() {
  const [polls, setPolls] = useState<PollRow[]>([]);
  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [status, setStatus] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [exportTopic, setExportTopic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportFormats, setReportFormats] = useState<Record<string, ReportFormat>>({});
  const [optionSelections, setOptionSelections] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    api.get("/polls", { params: { topic: topic || undefined, status: status || undefined } })
      .then((response) => setPolls(response.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [topic, status]);

  const visiblePolls = polls.filter((poll) => {
    const matchesTitle = !title || poll.title.toLowerCase().includes(title.toLowerCase());
    const matchesClass = !classFilter || poll.className === classFilter;
    const matchesDate = !dateFilter || poll.createdAt.slice(0, 10) === dateFilter;
    return matchesTitle && matchesClass && matchesDate;
  });
  const classes = [...new Set(polls.map((poll) => poll.className))].sort();

  function downloadOptionVoters(poll: PollRow) {
    const optionId = optionSelections[poll.id] || poll.options[0]?.id;
    const option = poll.options.find((item) => item.id === optionId);
    if (!optionId) return;
    const token = localStorage.getItem("teacherToken");
    fetch(`${API_BASE}/api/polls/${poll.id}/export/option-wise?optionId=${encodeURIComponent(optionId)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => { if (!response.ok) throw new Error("Could not download this option report."); return response.text(); })
      .then((csv) => { const workbook = XLSX.read(csv, { type: "string" }); const fileName = `${option?.text || "option"}-voters.xlsx`; XLSX.writeFile(workbook, fileName); recordDownload(fileName, `Voters for ${option?.text || "selected option"}`, poll.title); })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not download this option report."));
  }

  return (
    <div className="poll-history-page flex flex-col space-y-8">
      <section className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="font-medium text-slate-900">Option-wise voter downloads</h2><p className="mt-1 text-sm text-slate-500">Choose an option to download only the students who selected it.</p><div className="mt-3 space-y-2">{visiblePolls.map((poll) => { const optionId = optionSelections[poll.id] || poll.options[0]?.id; return <div key={poll.id} className="flex flex-wrap items-center gap-3"><span className="min-w-48 text-sm font-medium text-slate-700">{poll.title}</span>{poll.options.length > 0 && <><select value={optionId} onChange={(event) => setOptionSelections((previous) => ({ ...previous, [poll.id]: event.target.value }))} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">{poll.options.map((option) => <option key={option.id} value={option.id}>{option.text}</option>)}</select><button onClick={() => downloadOptionVoters(poll)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white">Download selected option (Excel)</button></>}</div>; })}{visiblePolls.length === 0 && <p className="text-sm text-slate-500">No filtered polls have options.</p>}</div></section>
      <div><h1 className="text-2xl font-semibold text-slate-900">Polling history</h1><p className="mt-1 text-sm text-slate-500">Review every poll and download voting information.</p></div>
      {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <section className="rounded-xl border border-slate-200 bg-white p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Filter by title" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /><input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Filter by topic" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /><select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">All classes</option>{classes.map((className) => <option key={className} value={className}>{className}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">All statuses</option><option value="DRAFT">Draft</option><option value="OPEN">Open</option><option value="LOCKED">Locked</option><option value="CLOSED">Closed</option></select><input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /></div><div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4"><input value={exportTopic} onChange={(event) => setExportTopic(event.target.value)} placeholder="Topic for full export" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /><button disabled={!exportTopic.trim()} onClick={() => downloadCsv(`${API_BASE}/api/polls/export/by-topic?topic=${encodeURIComponent(exportTopic.trim())}`, `topic-${exportTopic.trim()}.csv`)} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40">Download topic report</button><span className="text-sm text-slate-500">{visiblePolls.length} poll(s) shown</span></div></section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="divide-y divide-slate-100">{visiblePolls.map((poll) => { const format = reportFormats[poll.id] || "csv"; return <div key={poll.id} className="space-y-3 px-4 py-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="font-medium text-slate-900">{poll.title}</div><div className="mt-1 text-xs text-slate-500">{poll.className} · {poll.topic} · {new Date(poll.createdAt).toLocaleDateString()}</div></div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[poll.status] || STATUS_STYLES.DRAFT}`}>{poll.status}</span></div><div className="flex flex-wrap items-center gap-3"><span className="text-sm text-slate-600">{poll.totalVoted}/{poll.totalAuthorized} voted</span><button onClick={() => downloadCsv(`${API_BASE}/api/polls/${poll.id}/export?type=voted`, `${poll.topic}-voted.csv`)} className="text-sm font-medium text-brand-600">Download voted</button><button onClick={() => downloadCsv(`${API_BASE}/api/polls/${poll.id}/export?type=not-voted`, `${poll.topic}-not-voted.csv`)} className="text-sm font-medium text-brand-600">Download not-voted</button><span className="text-sm text-slate-500">Class sheet:</span><select value={format} onChange={(event) => setReportFormats((previous) => ({ ...previous, [poll.id]: event.target.value as ReportFormat }))} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"><option value="csv">CSV</option><option value="xlsx">Excel</option><option value="docx">Word</option><option value="pdf">PDF</option></select><button onClick={() => downloadClassSheet(poll, format)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white">Download</button></div></div>; })}{visiblePolls.length === 0 && !loading && <p className="px-4 py-8 text-sm text-slate-500">No polls match these filters.</p>}{loading && <p className="px-4 py-8 text-sm text-slate-500">Loading polling history...</p>}</div></section>
    </div>
  );
}

async function downloadClassSheet(poll: PollRow, format: "csv" | "xlsx" | "docx" | "pdf") {
  const token = localStorage.getItem("teacherToken");
  const response = await fetch(`${API_BASE}/api/polls/${poll.id}/export/class-roster`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Could not download this report.");
  const csv = await response.text();
  const workbookFromCsv = XLSX.read(csv, { type: "string" });
  const sheet = workbookFromCsv.Sheets[workbookFromCsv.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
  const filename = `${poll.topic.replace(/\s+/g, "_")}-class-roster`;
  if (format === "csv") {
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${filename}.csv`; anchor.click(); URL.revokeObjectURL(url); recordDownload(`${filename}.csv`, "Class roster", poll.title); return;
  }
  if (format === "xlsx") {
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "Class roster"); XLSX.writeFile(workbook, `${filename}.xlsx`); recordDownload(`${filename}.xlsx`, "Class roster", poll.title); return;
  }
  if (format === "docx") {
    const wordDocument = new Document({ sections: [{ children: rows.map((row) => new Paragraph({ text: row.join(" | ") })) }] });
    const blob = await Packer.toBlob(wordDocument); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${filename}.docx`; anchor.click(); URL.revokeObjectURL(url); recordDownload(`${filename}.docx`, "Class roster", poll.title); return;
  }
  const pdf = new jsPDF({ orientation: "landscape" }); pdf.setFontSize(10); pdf.text(`${poll.title} - Class roster`, 14, 14);
  rows.forEach((row, index) => pdf.text(row.join(" | "), 14, 24 + index * 7)); pdf.save(`${filename}.pdf`); recordDownload(`${filename}.pdf`, "Class roster", poll.title);
}