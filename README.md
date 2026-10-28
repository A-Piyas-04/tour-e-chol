# tour-e-chol

Mobile-first web app for friends on a tour to record shared expenses and see
**who owes whom** — without ever moving money. Every amount shown is a recorded
obligation, not a payment.

- **Stack:** Next.js (App Router) + TypeScript, Tailwind CSS, Supabase
  (PostgreSQL + Google OAuth), deployed on Vercel.
- **Accounting:** pure, deterministic TypeScript. Opposite debts between the
  same two people cancel pairwise (e.g. breakfast makes B owe A ৳100, a ride
  makes A owe B ৳10, and the app shows only **B owes A ৳90**). It does **not**
  globally minimize transfers.

## How the money math works

All amounts are stored and computed as **integer paisa** (৳1 = 100 paisa); no
floating point. See [`lib/money.ts`](lib/money.ts) and
[`lib/settlement.ts`](lib/settlement.ts).

1. Each expense's total is split **equally among its selected participants**,
   distributing leftover paisa deterministically (first participants by sorted
   user id get one extra paisa) so nothing is lost.
2. Within each expense, `net = paid − share`; creditors and debtors are matched
   greedily into direct transfers.
3. Transfers are accumulated across **all** expenses, then opposing transfers
   between each pair are netted so a pair appears in only one direction.

The result is independent of expense order, and deleting an expense fully
removes its effect (balances are always derived fresh, never stored).

## Security model

- The browser uses the Supabase **publishable** key for **authentication only**.
- All tour/member/expense reads and writes go through server actions in
  [`lib/actions.ts`](lib/actions.ts).
- Those actions verify the user with the cookie auth client
  (`auth.getUser()`), then explicitly check tour membership and role via
  [`lib/authz.ts`](lib/authz.ts) **before** touching data.
- Data access uses a **server-only admin client** ([`lib/supabase/admin.ts`](lib/supabase/admin.ts))
  with the secret key. RLS is enabled on every table with **no** client
  policies, so the browser can never read them directly. The admin key bypasses
  RLS, so the server-side checks are the only authorization — they are applied
  on every entry point.
- Leader promotion/demotion checks `tours.created_by === authenticated user`,
  never a role value from the request.

## Local setup

1. **Install**

   ```bash
   npm install
   ```

2. **Create a Supabase project** (free tier is fine) and run the migration in
   the Supabase SQL Editor:

   - Paste the contents of
     [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
     and run it.

3. **Configure Google OAuth**

   - In **Google Cloud Console**, create an OAuth web client. Set the
     **authorized redirect URI** to the Supabase Google provider callback URL
     (copy the exact URL from Supabase; it looks like
     `https://<project-ref>.supabase.co/auth/v1/callback`).
   - In **Supabase → Authentication → Providers → Google**, enable Google and
     paste the Client ID and Client Secret.
   - If your Google OAuth app is still in **Testing**, add each friend's Google
     account as a test user (or publish the app), or they will be blocked.

4. **URL configuration** in **Supabase → Authentication → URL Configuration**:

   - Site URL: `http://localhost:3000` for local dev.
   - Redirect allow list: add `http://localhost:3000/auth/callback` and, later,
     your production `https://<your-project>.vercel.app/auth/callback`.
   - Note: these app callback URLs are **different** from Google's Supabase
     provider callback URL in step 3.

5. **Environment variables** — copy `.env.example` to `.env.local` and fill in:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...   # anon / publishable key
   SUPABASE_SECRET_KEY=...                    # secret key (server only)
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

   If your project only exposes a legacy `service_role` key, set
   `SUPABASE_SERVICE_ROLE_KEY` instead of `SUPABASE_SECRET_KEY`. Never prefix a
   secret with `NEXT_PUBLIC_`. `.env.local` is gitignored.

6. **Run**

   ```bash
   npm run dev          # http://localhost:3000
   npm test             # unit tests for money + settlement
   npm run typecheck
   npm run build
   ```

## Deploy to Vercel

1. Push to GitHub and import the repo in Vercel.
2. Add the same four environment variables in Vercel's project settings. Set
   `NEXT_PUBLIC_SITE_URL` to the final `https://...vercel.app` domain.
3. Add `https://<your-project>.vercel.app/auth/callback` to the Supabase
   redirect allow list and set the Supabase Site URL to the production domain.
4. Deploy. Redeploy if you change environment variables.
5. Test Google login and cross-user balances on **two different Google
   accounts** and on a real phone.

## Manual verification checklist

Automated tests cover the accounting engine (`lib/*.test.ts`), including the
**B owes A ৳90** scenario and multi-payer cases. Verify the rest against a live
Supabase project:

1. A creates "Cox's Bazar Tour" with an 8-digit PIN via Google login.
2. B and others sign in with their own Google accounts and join with the PIN.
3. A records breakfast ৳1,000 (everyone), paid by A.
4. A records auto-rickshaw ৳60 (only 6 people incl. A and B), paid by B.
5. B sees **Need to Give → A → ৳90.00**; an absent rider has no ride liability.
6. A promotes B to leader; B can add expenses but cannot promote anyone.
7. Create a multi-payer expense (e.g. ৳1,000 split A ৳600 / B ৳400) and verify.
8. Delete an expense and confirm balances update immediately.
9. A user who never joined cannot open `/t/<guessed-id>` (redirected away).

## Scope / not built

No in-app transfers or payment integration, no "mark as paid", no currencies
other than BDT, no receipts, categories, charts, email invites, or global debt
minimization. Correcting an expense is **delete + recreate**.
