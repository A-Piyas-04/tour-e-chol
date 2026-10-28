# tour-e-chol — Mobile Tour Expense Tracker

> **AI IDE implementation prompt / MVP specification**  
> **Project name:** `tour-e-chol` (final name; use it for the repo, package name, and UI brand)  
> **Goal:** Build and deploy a working mobile-first Next.js web application for friends to record shared tour expenses and see **who owes whom**, without moving any money.

---

## 0. Instructions to the coding agent

**Implement the application, not merely a proposal or mockup.** Create the code, database migration, `.env.example`, tests, and a short setup/deployment `README.md`. Run the build and relevant tests and fix failures.

**Priorities, in order:**

1. Accurate accounting and debt cancellation.
2. Google sign-in, membership access, and leader permissions.
3. A fast, readable mobile UI that works on real phones.
4. Easy Supabase setup and Vercel deployment.

**Avoid overengineering:** no payment integration, wallets, notifications, receipts/uploads, chat, AI/agents, currencies other than BDT, microservices, state-management frameworks, elaborate animations, or complex infrastructure. Do not request a paid API key. Use free-tier-friendly services. Do not add a globally optimized settlement algorithm: **the required behavior is pairwise cancellation** (defined below).

**Agent behavior:** Make sensible decisions and implement autonomously. Ask the human only for external credentials or dashboard actions you genuinely cannot perform. Never invent credentials. If necessary, provide precise manual steps and continue with everything else.

---

## 1. What the app does

Ten friends take a tour. Different subsets of friends participate in different activities. Sometimes one friend pays the entire bill; sometimes two or more friends split the **payment**. These people are not necessarily the same people who share the **expense**.

The app records expenses and calculates each member's **Need to Give** and **Supposed to Get** lists. **It never initiates a payment** or asks for banking details. Every displayed amount is an outstanding *recorded obligation*, not proof that money has been transferred.

### Required example (must work exactly)

- **Breakfast:** 10 friends (A through J) participate. Cost = **৳1,000**. A pays ৳1,000. Each person's share = ৳100, so the other nine owe A ৳100 each.
- **Auto-rickshaw:** Only 6 friends participate, **including A and B**. Cost = **৳60**. B pays the entire ৳60. The other five participating members owe B ৳10 each; the four absent friends owe nothing for this ride.
- **Cancellation:** Before the ride, B owed A ৳100. The ride makes A owe B ৳10. **Final direct A/B obligation = B owes A ৳90.** Neither side should see an additional A-to-B ৳10 item.
- Many further expenses may have overlapping or disjoint participants. Recompute results from *all* saved expenses.

### Other essential situations

- A bill is paid by **multiple people**: e.g., cost ৳1,000; A pays ৳600 and B pays ৳400.
- Only selected members share an expense (never charge unselected members).
- A person may pay for an activity they did not attend: **payers may be any tour member**, while expense sharers are independently selected members.
- An expense may not divide evenly: handle fractional taka **exactly**, in paisa.
- The creator may make other members secondary leaders. A secondary leader can record expenses but **cannot appoint leaders**.

---

## 2. Stack and scope

| Layer | Choice | Reason |
|---|---|---|
| Web app | Next.js App Router + TypeScript | One codebase; server-side access control |
| UI | Tailwind CSS | Fast, responsive styling |
| Auth | Supabase Auth, **Google OAuth only** | No passwords or OTP system |
| Database | Supabase PostgreSQL | Persist tours, members, expense events |
| Data operations | Next.js Server Actions (or Route Handlers where appropriate) | No standalone backend |
| Hosting | Vercel | Simple Next.js deployment |
| Calculations | Pure TypeScript on the server | Easy to test, no extra service |

Use **`@supabase/ssr`** for cookie-based authentication. Follow the current Supabase Next.js guidance for `client.ts`, `server.ts`, auth-session refresh via `proxy.ts` in Next.js 16 (or the correct version-specific equivalent), and `/auth/callback` for OAuth code exchange.

**Security architecture (simple for this tiny MVP):**

- Browser uses the **publishable** Supabase client **for authentication only**.
- All tour/member/expense database reads and writes go through authenticated **server-side functions**.
- On the server, verify the current user with the **cookie-based Auth client** (`auth.getUser()`), then explicitly verify tour membership and permissions **before** accessing data.
- Use a separate **server-only Supabase admin client** with a Supabase **secret key** (or legacy `service_role` key) for DB reads/writes. This client must never be shipped to browser code. Do **not** attach the end-user JWT to it.
- Enable RLS on app tables with **no client-access policies**; the browser cannot directly read these tables. All authorization is enforced in the trusted Next.js server boundary. **Never omit the server-side authorization checks**, since the admin key bypasses RLS.

This approach intentionally avoids complicated membership RLS policies and permission-sensitive SQL functions. **It is secure only if every server entry point enforces the checks described here.**

---

## 3. User roles and authorization

| Capability | Regular member | Secondary leader | Original creator / owner |
|---|:---:|:---:|:---:|
| View their own give/get balances | Yes | Yes | Yes |
| View tour members' names for expense entry | No need | Yes | Yes |
| Record expense | No | Yes | Yes |
| View leader expense history | No | Yes | Yes |
| Delete incorrect expense (with confirmation) | No | Yes | Yes |
| Promote member to secondary leader | No | **No** | **Yes** |
| Revoke secondary-leader status | No | **No** | **Yes** |
| Change original owner | No | No | No |
| Create or join other tours | Yes | Yes | Yes |

Roles are **per tour**. A user can own Tour X and be a regular member in Tour Y.

**Non-negotiable:** Do not rely on hiding UI buttons for authorization. Check the session, tour membership, and the appropriate role inside *every* server action and protected page.

---

## 4. Screens and UX

**Target width: 360–430 px**, while still looking fine on desktop. Large touch targets (at least ~44 px), readable typography, bottom-safe-area spacing, short labels, and clear submit feedback. Use simple cards/chips, not dense spreadsheets.

### 4.1 Welcome / home — `/`

**Signed out:** brand, one-sentence description, **Continue with Google** button.

**Signed in:** two prominent choices:

1. **Create a Tour** — enter tour name and choose a **unique 8-digit numeric join PIN**. The creator is automatically the immutable owner. Show the code to the owner for sharing with friends (no in-app invitations required).
2. **Join a Tour** — show a mobile PIN-entry UI (eight digits). Submit to server, which checks the code and adds the user to that tour as `member`.

If the user already belongs to tours, show a compact **My Tours** list so they can open an existing tour. No complicated dashboard.

**PIN behavior:** Set once when creating the tour; **do not implement PIN rotation** in MVP. The owner chooses the code; it is *not* a single global hardcoded code for every tour. Reject a code already used by another tour and ask for a different one. Never publicly list or expose join codes. Require Google login before accepting a join attempt. An eight-digit PIN is a lightweight group gate, not enterprise-grade security; basic abuse throttling is a sensible post-MVP improvement.

### 4.2 Member's tour screen — `/t/[tourId]`

Show tour name, user name, and two sections **exactly oriented to the current user**:

**Need to Give**

| Person | Amount |
|---|---:|
| A | ৳90.00 |

**Supposed to Get**

| Person | Amount |
|---|---:|
| C | ৳10.00 |

- One row per *final net pairwise obligation*; don't display duplicate or mutually opposing obligations.
- Show a **total** for each section.
- Friendly empty state: **“You're all settled up!”** when appropriate.
- Members see only their own relationships; they do not need a complicated full-group ledger.
- Include a small **Refresh** action. Update server-rendered results when the page regains focus and roughly every 15–30 seconds **while visible** (no Supabase Realtime needed).
- No **Mark as Paid** button: manual repayment logging is outside the explicitly requested MVP. Make this limitation clear in a short hint if needed.

### 4.3 Leader's tour screen

A leader gets two simple tabs/pages:

1. **Balances** — the exact same personal give/get screen as a regular member.
2. **Manage** — `/t/[tourId]/manage` with **Add Expense**, **Recent Expenses**, and (owner only) a **Leaders** section.

**Add Expense form:**

- **Title:** e.g. “Breakfast at KFC”, “Auto-rickshaw to park”.
- **Total amount (৳):** positive, max 2 decimal places.
- **Who shared this expense?** Multi-select tour members as checkbox/chip list. Include **Select all / Clear**. Show selection count prominently. At least one participant is required.
- **Who actually paid?** One or more dynamically addable rows: `[member dropdown] [amount paid in ৳] [remove]`. Payers must be tour members, but **need not be selected participants**.
- Show **Paid total / Expense total** and a clear mismatch warning. Disable submission until the paid total equals the expense total **exactly in paisa**.
- One **Save Expense** button with loading state and success/error toast. Prevent duplicate clicks; reset form on success.

**Recent Expenses:** title, amount, created timestamp, participants count, and payer summary. Leaders can delete an incorrectly entered expense with confirmation and immediately recalculate balances. To keep the one-hour MVP narrow, correcting an expense is **delete + recreate**, not a separate full editor.

**Leaders (owner only):** list members, promote `member → leader`, demote `leader → member`; never promote/demote the `owner`. A leader must not be able to call either action successfully, even via a forged request.

---

## 5. Database schema — implement this migration

Use **three app tables only**. For this small, fixed-size expense record, **one JSONB column for payer contributions** and a UUID array for participants is intentional: each whole expense is saved or deleted as **one atomic row**. This avoids partially saved multi-table expenses and extra database transactions.

Create `supabase/migrations/0001_init.sql` with the following schema (adjust minor syntax only if necessary):

```sql
create extension if not exists pgcrypto;

create table public.tours (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  join_code text not null unique check (join_code ~ '^[0-9]{8}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.tour_members (
  tour_id uuid not null references public.tours(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 100),
  role text not null default 'member'
    check (role in ('owner', 'leader', 'member')),
  joined_at timestamptz not null default now(),
  primary key (tour_id, user_id)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  amount_paisa bigint not null
    check (amount_paisa > 0 and amount_paisa <= 1000000000000),
  participant_ids uuid[] not null
    check (cardinality(participant_ids) > 0),
  contributions jsonb not null
    check (jsonb_typeof(contributions) = 'array'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index expenses_tour_created_idx
  on public.expenses (tour_id, created_at desc);

create index tour_members_user_idx
  on public.tour_members (user_id);

-- All database operations use the authorized Next.js server boundary.
-- Direct browser queries with a publishable key must not be allowed.
alter table public.tours enable row level security;
alter table public.tour_members enable row level security;
alter table public.expenses enable row level security;

-- Do not add permissive anon/authenticated RLS policies.
-- The server-only secret/admin client bypasses RLS after explicit checks.
```

**Example `contributions` JSON:**

```json
[
  { "user_id": "<A-user-uuid>", "amount_paisa": 60000 },
  { "user_id": "<B-user-uuid>", "amount_paisa": 40000 }
]
```

`participant_ids` holds each user ID **once**; the server rejects duplicates. The server must validate that all IDs are members of the expense's tour, that every payer is distinct and contributed a positive amount, and that `sum(contributions.amount_paisa) === amount_paisa`.

**Creation consistency:** Create the tour and owner membership as a logical unit. For the MVP, after inserting the tour, insert the `owner` membership immediately; if that insert fails, delete the newly created tour and return an error. Do not route to an incomplete tour. If easy, a tiny SQL transaction/RPC is even better, but do not let this derail the MVP.

**Role invariant:** Only `created_by` is the true original owner. Always check `tours.created_by === authUser.id` for promotion/demotion; merely seeing a `role` value from a request must never grant this power. No self-declared owner roles.

**Important:** The database validates basic shapes; the server provides the cross-field and membership checks. Never accept JSONB payloads directly without validation.

---

## 6. Exact calculation specification (MOST IMPORTANT)

### 6.1 Money representation

- Store **integer paisa**, never floating-point BDT. **৳1 = 100 paisa**.
- Convert typed BDT strings to paisa by **parsing the decimal digits**, not by `parseFloat(value) * 100`.
- Accept `60`, `60.5`, `60.50`; reject negative values, `0`, `1.234`, malformed strings, values over configured safe maximum, `NaN`, and infinity.
- Convert DB `bigint` values carefully (Supabase may return strings); enforce `Number.isSafeInteger()` after conversion and keep input under the DB cap.
- Display BDT with 2 decimal places (`৳90.00`) without rounding the stored integer balance.

### 6.2 Split an expense among PARTICIPANTS

Only the **selected participants** share the total cost **equally**. Paid amounts have no effect on who participated.

For an expense of `T` paisa and `N` unique participants:

1. `baseShare = floor(T / N)`.
2. `remainder = T % N`.
3. Sort participant **user IDs** lexicographically to get deterministic order.
4. Give the first `remainder` participants **one extra paisa** each; everyone else gets `baseShare`.
5. Thus total participant shares equal `T` with **zero lost paisa**.

Example: ৳100.00 split by 3 → **৳33.34, ৳33.33, ৳33.33** (which member gets the extra paisa is determined by stable ID order).

### 6.3 Net contribution of each member INSIDE ONE expense

For every relevant tour member:

```
netPaisa[user] = paidPaisa[user] - participantSharePaisa[user]
```

- Positive net → this person advanced more than their share and must **receive** that amount.
- Negative net → this person paid less than their share and must **give** that amount.
- Zero net → no transfer needed for this event.
- A payer outside the selected participant set has a share of zero, so is correctly a creditor.
- Assert **sum of all net values = 0** for every expense.

### 6.4 Convert each expense's net balances to direct transfers

Within **each expense**, construct a list of creditors (positive net) and debtors (negative net), both sorted by **stable user ID**. Greedily match them:

```text
while debtors remain and creditors remain:
    amount = min(remainingDebtOfDebtor, remainingCreditOfCreditor)
    emit direct transfer (from = debtor, to = creditor, paisa = amount)
    subtract amount from both remaining values
    advance whichever balance reached zero
```

This is a **deterministic settlement** of each individual expense. Multiple payers are supported naturally; no fixed first payer and no double-counting. Do not create transfers to oneself.

### 6.5 NET OPPOSING TRANSFERS BETWEEN THE SAME TWO PEOPLE

Accumulate the direct transfers across **ALL expenses**. Then, for every unordered pair of users `(X,Y)`:

```
X_owes_Y = sum of expense transfers X → Y
Y_owes_X = sum of expense transfers Y → X

if X_owes_Y > Y_owes_X:
    final X → Y = X_owes_Y - Y_owes_X
else if Y_owes_X > X_owes_Y:
    final Y → X = Y_owes_X - X_owes_Y
else:
    no transfer between X and Y
```

**This is the crucial requirement from the story.** Breakfast creates `B → A ৳100`; the ride creates `A → B ৳10`; the final balance displays **only `B → A ৳90`**.

**Be precise about scope:** This algorithm cancels **opposite debts for each pair**. It intentionally **does not globally minimize transfers** or automatically rewrite `A → B → C` into `A → C`, because that would change which friend directly owes which other friend and could violate the requested A/B example. Some circular debts can remain, though every member's net monetary position is correct.

### 6.6 Build each user's UI lists

From the final directed transfers:

- **Need to Give** of user U = all transfers with `from = U`; display the recipient's name and amount.
- **Supposed to Get** of user U = all transfers with `to = U`; display the sender's name and amount.
- Never show negative, zero, or self-owed amounts.
- One row at most per other member per section, and a pair may appear in **only one direction** globally.
- Show sum totals for both sections.

**Consistency assertions:**

1. Across the tour, total amounts in all users' “Need to Give” lists = total in all “Supposed to Get” lists.
2. For each member, `totalGet - totalGive` = sum of that member's `(paid - participant share)` across all expenses.
3. Reversing the order in which expense records are returned **cannot change the final result**. Deterministic sorting of IDs is required.
4. Deleting an expense and recomputing from remaining expenses must entirely remove its effect.

**Implementation:** Put the pure calculator in `src/lib/settlement.ts` (or `lib/settlement.ts`), with typed inputs/outputs. Do not store calculated debts as independent database rows. Derive them fresh from source expenses on read; for ~10 friends and a normal tour's expenses, this is simple and inexpensive.

---

## 7. Server operations and validations

Provide server actions/functions with approximately these signatures (names can vary):

```ts
createTour({ name, joinCode })
joinTour({ joinCode })
getMyTours()
getTourBalances({ tourId })
getTourManageData({ tourId })        // leaders only
addExpense({ tourId, title, totalTaka, participantIds, payers })
deleteExpense({ tourId, expenseId }) // leaders only
setLeaderRole({ tourId, userId, isLeader }) // creator only
```

**Rules for every call:**

- Verify Google-authenticated user on server with Supabase Auth (`getUser()`). Never accept a `currentUserId` supplied by the browser.
- For any tour-specific request, check a matching `tour_members` row. If none, respond with 403/unauthorized and **never leak data**.
- For manager operations, check member role `leader`/`owner`.
- For leader assignment, check **tour's `created_by` equals authenticated user ID**; refuse changing owner.
- Read or delete an expense by **both `expense_id` and `tour_id`** after role verification; never operate on a row in a different tour.
- For `joinTour`, look up the **exact** code on the server, then insert membership. Existing member should be returned to the same tour without duplicate membership. Do not return a partial tour list for invalid PINs.
- For `createTour`, insert tour with the current authenticated user's ID, then add that user as `owner`.
- For `addExpense`, reject empty participants; duplicate member IDs; payers not in the tour; zero/negative payer amounts; incorrect totals; more than two decimals; invalid or empty titles. On success, save ONE complete expense row.
- `deleteExpense` should prompt for confirmation, then delete the authorized row, then refresh calculated balances.
- Keep join codes and server secret keys out of client-facing payloads except when showing the new code to its original owner. Never log secrets.
- Use reasonable runtime validations (Zod if convenient; otherwise explicit TypeScript validation) and human-readable errors.
- Prevent stale caching of personalized balances across users: dynamic server reads / no shared static cache.

**No `markAsPaid` workflow.** The MVP logs **expenses**, not repayment transactions. Implementing repayments later would require a clearly defined separate ledger rule and UI.

---

## 8. Suggested small file structure

```text
app/
  page.tsx                          # Google login, create/join, My Tours
  auth/callback/route.ts            # Supabase OAuth PKCE callback
  t/[tourId]/page.tsx               # Give/Get balances
  t/[tourId]/manage/page.tsx        # Expense entry + history + owner controls
components/
  google-sign-in.tsx
  create-join-tour.tsx
  balance-lists.tsx
  expense-form.tsx
  leader-controls.tsx
lib/
  supabase/client.ts                # browser auth client
  supabase/server.ts                # cookie-based auth client
  supabase/admin.ts                 # SERVER ONLY; secret key
  authz.ts                          # requireUser/requireTourMember/requireLeader/requireOwner
  actions.ts                        # authorized server operations
  money.ts                          # parse/format integer paisa
  settlement.ts                     # pure deterministic math
  settlement.test.ts                # essential automated tests
supabase/migrations/0001_init.sql
proxy.ts                             # if required by installed Next.js version
.env.example
README.md
```

Prefer a small number of understandable files rather than many abstractions. Avoid huge all-in-one components or adding dependencies unnecessarily.

---

## 9. Essential automated tests (run before deployment)

Write fast unit tests for `money.ts` and `settlement.ts` (Vitest or existing test runner). At minimum:

| # | Case | Required result |
|---|---|---|
| 1 | 10-person ৳1,000 breakfast, A pays all | Every other member owes A ৳100; A owes nobody |
| 2 | Then 6-person ৳60 ride paid by B, A and B in the 6 | **B owes A ৳90**; A does **not** owe B ৳10 separately; absent 4 not charged for ride |
| 3 | 10-person ৳1,000 expense, A pays ৳600, B ৳400 | A is net **+৳500**, B net **+৳300**, eight other members net **−৳100** each |
| 4 | ৳100 split among 3 | Shares are ৳33.34, ৳33.33, ৳33.33; sum exactly ৳100 |
| 5 | Payer is tour member but not participant | Payer is credited for all money paid; only selected participants are charged |
| 6 | Two opposing expenses fully cancel a pair | No row in either direction |
| 7 | Delete an expense | Balances recomputed correctly with no stale amounts |
| 8 | Mixed expense order | Same pairwise results regardless of row order |
| 9 | Invalid payer sum / invalid money input | Server rejects; no partial write |
| 10 | Permission scenarios | Member cannot add/delete; secondary leader cannot promote; owner can promote; user outside tour sees nothing |

Tests 9 and 10 can be integration/action-level assertions where practical; if external Supabase test setup is not available, implement authorization guards carefully and include a precise manual verification checklist.

**Acceptance demo:**

1. Person A creates “Cox's Bazar Tour” with an 8-digit join PIN using Google login.
2. A shares the PIN; B and other friends sign in with **their own Google accounts** and join.
3. A records breakfast ৳1,000 involving everyone, paid by A.
4. A records auto-rickshaw ৳60 involving only 6 people (A and B included), paid by B.
5. B refreshes the app: **Need to Give → A → ৳90.00**.
6. One of the four absent riders has **no extra liability from the ride**.
7. A promotes B to secondary leader. B can add an expense but cannot appoint C as leader.
8. Create a multiple-payer expense and verify accounting invariants.
9. Delete an erroneous expense and verify balances immediately update.
10. A user with another Google account who did not join cannot access tour URLs by guessing the ID.

---

## 10. Environment variables and external setup

Generate `.env.example`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

If the Supabase project provides only a legacy `service_role` key, support `SUPABASE_SERVICE_ROLE_KEY` **server-side** as an alternative to `SUPABASE_SECRET_KEY`, with one clearly documented choice. Never use `NEXT_PUBLIC_` for a secret/admin key. Add `.env.local` to `.gitignore`.

**Human dashboard setup (cannot be replaced by code alone):**

1. Create a Supabase project (free tier is sufficient for this small tour tracker).
2. Run `supabase/migrations/0001_init.sql` in Supabase SQL Editor, or through a correctly configured Supabase CLI.
3. In Google Cloud Console, create a Google OAuth web client and set the **authorized redirect URI to the Supabase-provided Google provider callback URL** (typically `https://<project-ref>.supabase.co/auth/v1/callback`; copy the exact URL from Supabase).
4. In Supabase **Authentication → Providers → Google**, enable Google sign-in and supply Google OAuth Client ID and Client Secret. In the UI, offer **Google sign-in only**. In **Google Auth Platform → Audience**, choose an appropriate external audience; **if the OAuth app is still in Testing, add all ten friends as test users** (or publish the app as appropriate), otherwise they may be blocked even when the Next.js code is correct.
5. In Supabase **Authentication → URL Configuration**, set the local/deployed Site URL and allow list of app redirects, including `http://localhost:3000/auth/callback` for local use and the exact Vercel production `https://<your-project>.vercel.app/auth/callback` URL. These **app callback URLs are different from Google's Supabase-provider callback URL** in step 3.
6. Put URL, publishable key, and secret/admin key in local `.env.local` and Vercel's environment variables. Keep the secret out of commits and browser bundles.
7. Push to GitHub and deploy to Vercel. Set `NEXT_PUBLIC_SITE_URL` to the final deployed HTTPS domain; update Supabase redirect allow list accordingly; redeploy if environment variables change.
8. Test Google login and cross-user balances on **two separate Google accounts** and on a real phone.

**Important reality check:** The application can be coded rapidly, but completion within one hour depends on how fast Google OAuth, Supabase, and Vercel account configuration is completed. Do not claim deployment is finished until the real OAuth and database flows work on the public URL.

**Docs for implementation (use current versions):**

- Supabase Next.js SSR: https://supabase.com/docs/guides/auth/server-side/creating-a-client
- Supabase Google login: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase redirect allow lists: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase API keys / RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Next.js + Supabase starter: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
- Google OAuth audience / test users: https://support.google.com/cloud/answer/15549945

---

## 11. Execution order (the actual build plan)

**Phase A — Working skeleton**

- Scaffold Next.js + TypeScript + Tailwind.
- Implement Supabase SSR Google sign-in and callback.
- Create SQL migration and env example.
- Implement protected create/join tour and persistent membership.

**Phase B — Accounting engine first**

- Implement paisa parsing/formatting.
- Implement equal-share allocation, per-event netting, event transfers, and cross-event **pairwise cancellation**.
- Run essential unit tests, especially **B → A ৳90** and multi-payer tests.

**Phase C — Minimal UI and permissions**

- Member Give/Get page.
- Leader expense form + expense history + delete.
- Original owner-only secondary leader management.
- Mobile-friendly layouts, validation feedback, active-loading states, refresh on page focus.

**Phase D — Production check**

- Run lint (if configured), tests, TypeScript checks, and `npm run build`.
- Verify all route/action permissions and multi-account sign-in.
- Create short `README.md` with exact setup, deploy steps, screenshots not required.
- Deploy to Vercel if credentials/access allow; otherwise leave code deploy-ready and clearly list only the remaining human dashboard actions.

---

## 12. Explicit exclusions and completion criteria

**Do not build:** in-app transfers, bKash/Nagad integration, payment confirmation, settlement-history payments, paid API calls, global debt minimization, receipt images, expense categories, sophisticated charts, invitations by email, offline-first sync, multiple currencies, or a large admin dashboard.

**Finished means:** ten users can Google sign in, join the same tour by secret PIN, see member-specific direct obligations, and leaders can enter any number of multi-participant/multi-payer expenses with exact balances. The original creator can assign secondary leaders, and only that creator can do so. The two-example scenario must output **B owes A exactly ৳90**. The app passes tests, builds successfully, and is deployment-ready (or deployed if external setup is supplied).

> **Final instruction to AI IDE:** Build this complete functional MVP now. Accuracy, authorization, and clean mobile UX matter much more than sophistication. The app name is `tour-e-chol`: use it for the package name and UI brand, and keep it configurable in one place.
