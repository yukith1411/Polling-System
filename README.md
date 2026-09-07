# Class Polling System

Full-stack polling app for teachers to run authorized, single-vote-per-student polls
shared over WhatsApp/QR, with live results.

**Stack:** React + TypeScript (Vite, Tailwind) · Node.js + Express + TypeScript · PostgreSQL/SQLite via Prisma · Socket.IO

## How the core workflow maps to the code

Teacher creates poll → selects students → generates link → shares on WhatsApp → student opens link →
enters email → **backend checks authorization** → OTP → poll → vote → teacher sees results (live).

- **Authorization is server-side only.** `POST /api/public/polls/:token/request-otp` checks the email
  against `PollAuthorizedEmail` *before* anything else happens. Unauthorized emails get a generic
  403 and never see poll options — the options aren't even fetched until a valid OTP-backed session exists.
- **OTP** is generated, bcrypt-hashed, and stored server-side; only the student's email ever sees the
  plaintext code (via `sendOtpEmail`). Verifying it issues a short-lived (30 min) JWT "poll session"
  token — that token, not the raw email, is what's required to fetch poll content or vote.
- **One vote per student** is enforced twice: application-level check before insert, and a DB-level
  `@@unique([pollId, voterEmail])` constraint as the real backstop against race conditions.
- **Lock / open / close** are just poll status transitions (`DRAFT → OPEN → LOCKED/CLOSED`), broadcast
  live to the teacher dashboard over Socket.IO.
- **Select one at a time / select all** is the checkbox + "Select all" toggle in `CreatePollPage` and
  `PollDetailPage`, backed by `PATCH /api/polls/:id/authorized-emails`.

## Project layout

```
backend/    Express + Prisma + Socket.IO API
frontend/   React + Vite teacher & student UI
```

## Running it locally

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run seed        # optional: creates a demo teacher + class + poll
npm run dev          # http://localhost:4000
```

> **Note:** `npx prisma generate` needs to download a query-engine binary from
> `binaries.prisma.sh`. This works fine on a normal machine/network — it's the one step
> that couldn't be verified inside the sandbox this project was built in, since that
> environment's network allowlist doesn't include that domain. Everything else
> (TypeScript compiles, the frontend builds) was verified directly.

Demo login after seeding: `teacher@example.com` / `password123`.
Demo students: `aisha@example.com`, `rahul@example.com`, `priya@example.com` — OTPs for
them will print to the backend terminal (see "Email / OTP delivery" below).

### 2. Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

Open `http://localhost:5173`, sign up (or use the seeded login), create a class, add
students, create a poll, and open the generated `/vote/:token` link in another
browser/incognito window to try the student flow.

## Email / OTP delivery

By default `EMAIL_MODE=console` in `backend/.env` — OTP codes print to the backend's
terminal instead of being emailed, so you can test the full flow with zero external
setup. To send real email, set:

```
EMAIL_MODE=smtp
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM="Your School <no-reply@yourschool.org>"
```

(Any standard SMTP provider works — SendGrid, Mailgun, Gmail with an app password, etc.)

## Switching to PostgreSQL

SQLite is the default so there's nothing to install to try it. For Postgres:

1. In `backend/.env`: `DATABASE_URL="postgresql://user:pass@localhost:5432/polling"`
2. In `backend/prisma/schema.prisma`: change `provider = "sqlite"` to `provider = "postgresql"`
3. `npx prisma migrate dev --name init`

## Testing checklist (matches the spec's required test cases)

| Scenario | How to verify |
|---|---|
| Authorized student | Use one of the seeded student emails on the `/vote/:token` link — OTP is sent, poll loads. |
| Unauthorized student | Use any email not on the roster — you get "not authorized" and never see poll options (check `AccessAttempt` table / server logs to confirm no poll content was served). |
| Duplicate vote | Vote once, then try again with the same email — second `request-otp` returns 409 "already voted"; a direct repeat `POST /vote` (if attempted) hits the DB unique constraint. |
| Expired/locked poll | Set poll status to `LOCKED` or `CLOSED` from the dashboard, then try to vote — request is rejected with the poll's current status. |
| Teacher lock | Click "Lock poll" — voting is blocked immediately; already-open student tabs get the status change live via Socket.IO. |

## What's implemented vs. what needs your own credentials

Implemented end-to-end: teacher auth, class/student rosters, poll creation with
single/multi-select, per-poll student authorization (individually or "select all"),
OTP-gated access, one-vote enforcement, lock/unlock/close, live results via Socket.IO,
WhatsApp share link, QR code, CSV export (voted / not-voted / by-topic across polls).

Needs you to supply real credentials to go live: SMTP for actual OTP emails (works
today in console/dev mode with zero setup), and a production Postgres connection
string when you're ready to move off SQLite.
