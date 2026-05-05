# Instructions for Members 1, 3, and 4 (to integrate Trust & Rating)

This document covers **ONLY what the other members need to do** so Member 2’s frontend works end-to-end.

Frontend location: `spm-repo/frontend/`  
Frontend expects a Supabase backend (Postgres + RLS) right now.

> **Security note:** Never put the **Supabase service role key** in the frontend. Use only anon key in `.env`.

## Current access constraint (important)
At the moment, **only Member 2 has access to the Supabase project**. That means:
- **Member 3** defines the security rules/policies (what should be allowed)
- **Member 2** applies the RLS policies inside Supabase (because they have access)
- **Member 4** focuses on integration testing + deployment, and provides DB/indexing recommendations (but may not be able to apply changes)

---

## Member 1 — Backend Lead (Business Logic)

### Your goal
Implement the **Trust Score engine + badge logic** and provide consistent data for the UI.

### What the frontend expects
Member 2 frontend currently queries:
- `reviews` table (ratings + comments)
- `user_trust` table (trust score + verified + badges)

### Your tasks
- **Trust score algorithm**
  - Decide the formula and thresholds (e.g., based on rating history, account age, verification status, report history).
  - Keep it deterministic and explainable.
- **Trust score updates**
  - When to recalculate:
    - after a new review is inserted
    - after a review is updated/deleted
    - after verification status changes
    - after moderation/report penalty changes
- **Badges**
  - Define badge rules and thresholds (e.g. “Trusted Neighbor”, “Community Star”).
  - Decide how to store badges:
    - simplest: `user_trust.badges` as `jsonb` array of `{ id, name, description, icon }`
    - better: separate tables (`trust_badges`, `user_trust_badges`) (optional if time is short)

### How to implement (recommended on Supabase)
- Use a server-side job (Node script / serverless function) that uses **service role key** (server only) to:
  - read `reviews`
  - compute trust score
  - write `user_trust`
- Optionally add a DB trigger on `reviews` to enqueue recalculation.

### Deliverables
- Trust score spec (1–2 pages)
- Badge list + rules
- Implementation that updates `user_trust` reliably

---

## Member 3 — Auth & Security + Middleware

### Your goal
Ensure **only valid users can create/edit/delete reviews** and abuse is prevented.

### Decisions you must make (then enforce)
- Who can write reviews?
  - verified-only OR any logged-in user OR public demo mode
- Duplicate prevention:
  - one review per (reviewer, targetType, targetId)
- Edit/delete permissions:
  - only the original reviewer can edit/delete their review

### What to implement (Supabase approach)
If you’re using Supabase Auth:
- Enable RLS and add policies:
  - **SELECT** reviews: public or authenticated (choose)
  - **INSERT** reviews: authenticated only (recommended)
  - **UPDATE/DELETE**: only by `auth.uid()` owner
- Add `reviewer_id uuid not null` in `reviews` referencing auth user id
- On insert/update, set `reviewer_id = auth.uid()` (via `DEFAULT` or using policy conditions)

If you’re using your own JWT/Express auth:
- Do NOT expose service role key to frontend
- Provide REST endpoints and validate:
  - token
  - role
  - ownership
  - rate limits

### Deliverables
- Auth method chosen (Supabase Auth vs custom JWT)
- RLS policies or middleware rules implemented
- Duplicate review prevention enforced server-side

---

## Member 4 — DevOps + DB + Testing + Integration

### Your goal
Ensure the integrated system runs end-to-end, is testable, and is deployable.

### 1) DB + performance recommendations (since you may not have Supabase access)
Provide a short note to Member 2 on:
- required tables/views (`reviews`, `user_trust`) and required columns (`created_at` vs `timestamp`)
- indexes to keep pages fast (recommended):
  - `reviews(target_type, target_id, created_at desc)`
  - `reviews(target_type, target_id, rating)`
  - `user_trust(user_id)`

### 2) Integration testing checklist (must)
- Create review -> it appears in list
- Rating summary updates
- Trust score endpoint/table returns data
- Badges render on user profile
- Edit/delete works and refreshes UI

### 3) Deployment checklist (must)
- Deploy frontend to Vercel/Netlify
- Configure env vars in deployment:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Smoke test all routes after deploy

### Deliverables
- Integration report (screenshots + what routes tested)
- Deployment URL + steps
- DB/indexing recommendations sent to Member 2

---

## Notes for the whole team (integration contract)
- Frontend uses:
  - `reviews` table for list/create/update/delete
  - `ratings` summary computed from `reviews`
  - `user_trust` for trust score + badges
- If you switch to pure MERN (MongoDB + Express) later:
  - keep the same response shapes and only swap `frontend/src/api/*.js` to call REST instead of Supabase.

