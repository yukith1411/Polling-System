import { useEffect, useState } from "react";
import { clearDownloadHistory, getDownloadHistory } from "../lib/downloadHistory";
import type { DownloadRecord } from "../lib/downloadHistory";

export default function DownloadHistoryPage() {
  const [history, setHistory] = useState<DownloadRecord[]>(getDownloadHistory);

  useEffect(() => {
    const refresh = () => setHistory(getDownloadHistory());
    window.addEventListener("download-history-change", refresh);
    return () => window.removeEventListener("download-history-change", refresh);
  }, []);

  return <div className="space-y-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold text-slate-900">Downloaded history</h1><p className="mt-1 text-sm text-slate-500">Review reports downloaded from this browser.</p></div><button disabled={!history.length} onClick={() => { clearDownloadHistory(); setHistory([]); }} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 disabled:opacity-40">Clear history</button></div><section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="divide-y divide-slate-100">{history.map((item) => <div key={item.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-medium text-slate-900">{item.fileName}</div><div className="text-sm text-slate-500">{item.pollName} · {item.reportType}</div></div><time className="text-xs text-slate-500">{new Date(item.downloadedAt).toLocaleString()}</time></div>)}{!history.length && <p className="px-4 py-8 text-sm text-slate-500">No reports have been downloaded yet.</p>}</div></section></div>;
}