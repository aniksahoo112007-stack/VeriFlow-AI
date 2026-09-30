# VeriFlow AI

**AI-Powered Document Intelligence & Approval Platform**

VeriFlow AI converts invoices, purchase orders, receipts, expense bills, forms, and contracts into structured, validated, reviewable decisions. It combines Gemini multimodal extraction with deterministic backend validation, explainable risk scoring, human approval, notifications, analytics, and a durable audit trail.

No sample users, documents, analytics, or notifications are shipped. An empty database produces intentional empty states.

## What it solves

Manual document handling is slow, inconsistent, and difficult to audit. VeriFlow makes the transformation explicit:

`private file → AI extraction → deterministic validation → risk assessment → human decision → audit history`

## Features

- Email/password authentication with bcrypt, short-lived JWT access tokens, rotated hashed refresh tokens, and secure HTTP-only cookies
- Verified Google ID-token login when configured
- Private Supabase Storage uploads and short-lived authorized preview URLs
- PDF, PNG, JPEG, and WebP ingestion up to a configurable limit (10 MB by default)
- Gemini structured classification and extraction with Zod validation and a strict “do not invent values” instruction
- Duplicate, required-field, amount consistency, date, GSTIN-format, and invoice/PO checks
- Explainable 0–100 document risk assessment (not a fraud probability)
- Editable extracted fields followed by automatic revalidation and risk recalculation
- Approve, reject, and request-review decisions with comments
- Responsive dashboard, search/filter/pagination, review queue, real Recharts analytics, notifications, administration, and audit views
- Centralized errors, security headers, CORS, rate limits, role checks, ownership checks, MIME/size checks, and secret isolation

## Architecture

```text
React/Vite (Vercel)
        │ Axios + access JWT; refresh cookie
        ▼
Express API (Render)
   ├── Supabase PostgreSQL (private service access)
   ├── Supabase Storage: private `documents` bucket
   └── Google Gemini multimodal API
```

The browser never receives the Supabase secret key or Gemini key. Primary application data always flows through Express. RLS is enabled without anonymous/client policies; Express enforces the authenticated identity and ownership before data or signed preview URLs are returned.

## Repository structure

```text
frontend/  React, Vite, React Router, Tailwind, Axios, Recharts, Lucide
backend/   Express routes/controllers/services, schema.sql, tests
```

## Required setup

### 1. Supabase database and private storage

1. Open the Supabase SQL Editor for the target project.
2. Run [`backend/schema.sql`](backend/schema.sql) in full.
3. The script creates the application tables, constraints, indexes, updated-at triggers, enables RLS, and creates/updates the private `documents` storage bucket.
4. In Supabase project settings, copy the **server-side secret/service-role key** into `backend/.env` as `SUPABASE_SECRET_KEY`. Never use the publishable/anon key here.

The schema is rerunnable where PostgreSQL permits it (`IF NOT EXISTS`, replaced functions, safely recreated triggers, and bucket upsert). It creates no broad `USING (true)` policies.

### 2. Gemini

1. Create a Gemini API key in Google AI Studio.
2. Set `GEMINI_API_KEY` in `backend/.env`.
3. Set `GEMINI_MODEL` to a multimodal Flash model available to that key. The current default is `gemini-3.8-flash` and remains environment-configurable.

Invalid or unavailable model configuration returns a clear processing failure, keeps the original document, and allows retry. No fake extraction is substituted.

### 3. Authentication secrets

Generate two different high-entropy values and set:

```env
JWT_ACCESS_SECRET=<random secret>
JWT_REFRESH_SECRET=<different random secret>
```

The current implementation uses an opaque random refresh token whose SHA-256 hash is stored in PostgreSQL. `JWT_REFRESH_SECRET` remains required configuration for secret separation and future signed-refresh migrations; it is never sent to the browser.

### 4. Optional Google Sign-In

Create a Google OAuth web client and add local and production frontend origins. Set the same client ID in:

```env
# frontend/.env
VITE_GOOGLE_CLIENT_ID=...

# backend/.env
GOOGLE_CLIENT_ID=...
```

When the frontend value is blank, the Google button is intentionally hidden. The backend always verifies configured Google credentials with `google-auth-library` before using their claims.

### 5. Optional admin bootstrap

Set `ADMIN_EMAILS` in `backend/.env` to comma-separated normalized emails. A verified matching account is promoted to admin at registration/login. Further role changes are available in Administration and are audited.

## Local development

Prerequisite: Node.js 20+.

```powershell
cd backend
npm install
npm run dev
```

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The API health endpoint is `http://localhost:5000/api/health`; `GET /api/health/database` performs a real Supabase query and fails when the database is unavailable.

## Environment variables

Copy the committed `.env.example` files when setting up a new environment. Local `.env` files are gitignored.

Backend: `PORT`, `NODE_ENV`, `FRONTEND_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS`, `MAX_UPLOAD_MB`.

Frontend: `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_GOOGLE_CLIENT_ID`. The Supabase frontend values are public configuration only; the current application does not use them for privileged data access.

## Commands and verification

```powershell
cd backend
npm test
npm start

cd ..\frontend
npm run build
npm run preview
```

## API overview

- Health: `GET /api/health`, `GET /api/health/database`
- Auth: `POST /api/auth/register|login|google|refresh|logout`, `GET /api/auth/me`
- Documents: `GET|POST /api/documents`, `GET /api/documents/:id`, `POST /:id/process`, `GET /:id/preview`, `PATCH /:id/extracted-fields`, `POST /:id/review`
- Analytics: `GET /api/analytics/overview`
- Notifications: `GET /api/notifications`, `PATCH /api/notifications/:id/read`
- Admin: `GET /api/admin/users`, `PATCH /api/admin/users/:id/role`, `GET /api/admin/audit`

All application routes except health and sign-in/register endpoints require authentication. Admin routes additionally require the admin role.

## Deployment

### Vercel (frontend)

- Root Directory: `frontend`
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Set `VITE_API_BASE_URL=https://YOUR-RENDER-SERVICE/api` and the other frontend variables.
- `frontend/vercel.json` provides SPA route fallback.

### Render (backend)

- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Set every required backend variable and `NODE_ENV=production`.
- Set `FRONTEND_URL` to the exact HTTPS Vercel origin. Secure refresh cookies then use `SameSite=None`.

## Security notes

- Never commit local `.env` files or expose server credentials to Vite variables.
- Use different, long random JWT secrets in every environment and rotate them if exposed.
- Keep the storage bucket private. VeriFlow authorizes each preview before producing a five-minute signed URL.
- GSTIN validation checks format only; it does not claim registration verification.
- Gemini output is untrusted input: it is schema-constrained, parsed, and validated again before persistence.
- Production startup refuses to run when Supabase, Gemini, or JWT configuration is missing.
