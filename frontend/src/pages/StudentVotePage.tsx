import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { studentApi, withStudentSession, apiErrorMessage } from "../api/client";

type Step = "loading" | "login" | "vote" | "done" | "invalid" | "closed";

interface PollMeta {
  title: string;
  topic: string;
  teacherName: string;
  className: string;
  status: string;
}
interface PollContent {
  id: string;
  title: string;
  description?: string;
  allowMultipleAnswer: boolean;
  allowVoteChange: boolean;
  status: string;
  options: { id: string; text: string }[];
  alreadyVoted: boolean;
  yourSelections: string[];
}

export default function StudentVotePage() {
  const { shareToken } = useParams();
  const [step, setStep] = useState<Step>("loading");
  const [meta, setMeta] = useState<PollMeta | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [content, setContent] = useState<PollContent | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    studentApi
      .get(`/${shareToken}`)
      .then((r) => {
        setMeta(r.data);
        setStep(r.data.status === "CLOSED" ? "closed" : "login");
      })
      .catch(() => setStep("invalid"));
  }, [shareToken]);

  async function studentLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data } = await studentApi.post(`/${shareToken}/student-login`, { email: normalizedEmail, password });
      setEmail(normalizedEmail);
      setSessionToken(data.sessionToken);
      const contentRes = await studentApi.get(`/${shareToken}/content`, withStudentSession(data.sessionToken));
      setContent(contentRes.data);
      setSelected(new Set(contentRes.data.yourSelections));
      setStep(contentRes.data.alreadyVoted && !contentRes.data.allowVoteChange ? "done" : "vote");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleOption(id: string) {
    if (!content) return;
    const nextSelection = (() => {
      if (!content.allowMultipleAnswer) return new Set([id]);
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    })();
    setSelected(nextSelection);
    if (content.allowVoteChange && nextSelection.size > 0) {
      setBusy(true); setError(null);
      try { await studentApi.post(`/${shareToken}/vote`, { optionIds: [...nextSelection] }, withStudentSession(sessionToken!)); setContent((previous) => previous ? { ...previous, alreadyVoted: true, yourSelections: [...nextSelection] } : previous); }
      catch (err) { setError(apiErrorMessage(err)); }
      finally { setBusy(false); }
    }
  }

  async function submitVote(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionToken || selected.size === 0) return;
    setError(null);
    setBusy(true);
    try {
      await studentApi.post(`/${shareToken}/vote`, { optionIds: [...selected] }, withStudentSession(sessionToken));
      setStep("done");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        {step === "loading" && <p className="text-slate-500 text-sm">Loading poll…</p>}

        {step === "invalid" && (
          <p className="text-red-600 text-sm">This poll link is invalid or no longer exists.</p>
        )}

        {step === "closed" && (
          <>
            <h1 className="text-lg font-semibold text-slate-900 mb-1">{meta?.title}</h1>
            <p className="text-sm text-slate-500">This poll has closed and is no longer accepting votes.</p>
          </>
        )}

        {meta && (step === "login" || step === "vote") && (
          <div className="mb-5">
            <p className="text-xs uppercase tracking-wide text-brand-600 font-medium mb-1">{meta.className}</p>
            <h1 className="text-lg font-semibold text-slate-900">{meta.title}</h1>
            <p className="text-sm text-slate-500 mt-0.5">By {meta.teacherName} · {meta.topic}</p>
          </div>
        )}

        {step === "login" && (
          <form onSubmit={studentLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Your registered email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Student password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <p className="mt-1 text-xs text-slate-400">Use the password provided by your teacher.</p>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={busy} className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2.5 font-medium disabled:opacity-60">
              {busy ? "Signing in…" : "Open poll"}
            </button>
          </form>
        )}

        {step === "vote" && content && (
          <form onSubmit={submitVote} className="space-y-4">
            {content.description && <p className="text-sm text-slate-600">{content.description}</p>}
            <p className="text-xs text-slate-400">
              {content.allowVoteChange ? "Your selection is saved immediately. You can change it anytime while voting is open." : content.allowMultipleAnswer ? "Select one or more options" : "Select one option"}
            </p>
            <div className="space-y-2">
              {content.options.map((o) => (
                <label
                  key={o.id}
                  className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 text-sm cursor-pointer ${
                    selected.has(o.id) ? "border-brand-500 bg-brand-50" : "border-slate-200"
                  }`}
                >
                  <input
                    type={content.allowMultipleAnswer ? "checkbox" : "radio"}
                    name="option"
                    checked={selected.has(o.id)}
                    onChange={() => { void toggleOption(o.id); }}
                  />
                  {o.text}
                </label>
              ))}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {!content.allowVoteChange && <button
              disabled={busy || selected.size === 0}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2.5 font-medium disabled:opacity-60"
            >
              {busy ? "Submitting…" : "Submit vote"}
            </button>}
          </form>
        )}

        {step === "done" && (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-lg font-semibold text-slate-900">Thanks — your vote is recorded!</h2>
            <p className="text-sm text-slate-500 mt-1">You can close this page now.</p>
          </div>
        )}
      </div>
    </div>
  );
}
