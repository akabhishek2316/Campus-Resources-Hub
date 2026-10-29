# ResourcesHub

A trusted platform for a college to share its underused labs, tools and rooms. It is built for the "Unlock Underused Equipment and Spaces" hackathon problem and covers the whole lifecycle:
list, discover, request, verify, review, approve or waitlist, check in, return, handle incidents, and read the full history.

**Stack:** Next.js 14 (App Router) + TypeScript + Tailwind CSS, Supabase (Postgres, Auth, Storage, Row Level Security). Optional Gemini AI.

---

## 1. What you need

- Node.js 20.6 or newer (`node -v`)
- A free Supabase account: https://supabase.com
- Optional: a free Gemini API key from https://aistudio.google.com/apikey (the app works without it)

## 2. Setup, step by step (about 10 minutes)

**Step 1. Create a Supabase project.** Choose any name and region, and save the database password.

**Step 2. Create the database.** In Supabase open **SQL Editor > New query**, paste the whole of `supabase/schema.sql`, and press **Run**. It creates all tables, security rules, the audit log protection, the double-booking guard and the private `evidence` storage bucket.

**Step 3. Turn off email confirmation** (so sign-up works instantly during the demo): **Authentication > Providers > Email > turn off "Confirm email" > Save**.

**Step 4. Copy your keys.** Go to **Project Settings > API** and copy the Project URL, the `anon` key and the `service_role` key.

**Step 5. Configure the app.** In the project folder:

```bash
cp .env.example .env.local        # Windows PowerShell: copy .env.example .env.local
```

Open `.env.local` and fill in the three Supabase values. Leave the rest as is, or add `GEMINI_API_KEY`. If your college is not in India, change `NEXT_PUBLIC_TZ_OFFSET_MIN` (minutes from UTC; India is 330).

**Step 6. Install, seed and run:**

```bash
npm install
npm run seed      # creates demo users and fictional demo data
npm run dev       # open http://localhost:3000
```

You can run `npm run seed` again safely; it refreshes the demo users and will not duplicate data.

## 2a. Upgrading from the previous version

If you already ran the old schema, run `supabase/migration_002_role_applications.sql` if role-application columns are missing, then run `supabase/migration_003_owner_manager_invites.sql` in Supabase SQL Editor. For a fresh database, run the complete updated `supabase/schema.sql`.

## 2b. How registration and roles work

1. Public **Register** offers only **Student** and **Resource Owner**.
2. **Students** give a college email and college ID number.
3. **Resource owners** give job title and employee ID, and upload a **resume or CV** and a **staff ID card or appointment letter** (PDF, Word or photo, up to 3 MB each).
4. New accounts do not grant themselves privileged roles. The admin reviews and approves owner applications.
5. A verified owner can open **Team management** and create a one-time manager invitation. The link expires after 7 days and must be shared privately; no email provider is configured.
6. A manager must accept with the invited email. A manager can have only one active owner assignment; the owner can revoke access.
7. Managers can only act on resources assigned to them, and server actions check their booking, check-in/return, and incident permissions.
8. Every submission and every decision is written to the audit log.

## 3. Demo accounts

All passwords are `Demo@1234`.

| Email | Role | Good for showing |
|---|---|---|
| `student1@demo.edu` | Student, verified, **no training** | Eligibility failure, OTP, check-in and return |
| `student2@demo.edu` | Student, verified, **has 3D printer and electronics training** | A student who passes the checks; competing requests |
| `student3@demo.edu` | Student, **not verified**, request pending | Verification gate; shows in the admin's registration queue |
| `applicant.owner@demo.edu` | Applied to become a **lab owner**, documents uploaded, pending | Admin review of job documents |
| `owner@demo.edu` | Lab owner | Listing, review queue, approvals with reasons |
| `manager@demo.edu` | Manager assigned to the demo owner | OTP check-in, return confirmation, incidents |
| `admin@demo.edu` | Admin | Verification, training proofs, roles, audit log, statistics |

Seeded data (dates are set relative to today): 6 resources, one approved booking with a waitlisted rival (GPU workstation), one pending request (DSLR), one approved booking ready for check-in (Seminar Hall), and one returned booking with two open incidents (oscilloscope).

## 4. A 5-minute judge walkthrough

1. **Eligibility.** Sign in as `student1@demo.edu`. Open **Resources**, search "I need to print an enclosure" with **Smart match** ticked. The 3D printer card says *Missing: 3D printer safety*. Open it and send a request: it is blocked and the exact reasons are recorded.
2. **Request and compete.** As `student2@demo.edu`, open **Canon DSLR kit** and request the same slot as the seeded pending request (2 working days ahead, 10:00, 3 hours). The page explains that another request competes and shows the priority score.
3. **Review with a reason.** Sign in as `owner@demo.edu`, open **Requests**, open a request and press **Approve** with a reason. The competing request moves to the waitlist automatically, with an explanation, and both students are notified.
4. **OTP check-in.** As `student1@demo.edu`, open **My bookings > Seminar Hall A**. Record the condition before use (rating, notes, a photo), and note the 6-digit OTP. Sign in as `manager@demo.edu`, open the booking from **Requests > Ready for check-in**, type the OTP and check in.
5. **Return and incident.** As `student1@demo.edu` return the item: rating, notes, a photo. Tick "damaged" or give a lower rating than before. An incident is opened automatically.
6. **Human decision.** As `manager@demo.edu` confirm the return, then open **Incidents**. Press **Summarise the evidence** (advisory only), then resolve with *no action*, *warning* or *7-day suspension* and an explanation. Both parties are notified.
7. **History.** Every booking page has a timeline. As `admin@demo.edu` open **Audit log** and **Statistics**.

## 5. How it meets the hackathon criteria

| Requirement | Where it lives |
|---|---|
| Listings with availability, location, rules, eligibility | `staff/resources/new`, `resources/[id]` |
| Search, filters, smart matching | `resources/page.tsx`, `lib/ai.ts` (Gemini with keyword fallback) |
| Verification and eligibility checks | ID verification, training proofs reviewed by an admin, checked server-side on every request (`actions/bookings.ts`) |
| Approval, rejection, waitlist with reasons | `decideBooking`; a reason is mandatory and shown to the student |
| Competing requests and conflicts | Overlap checks, automatic demotion of rivals, waitlist promotion on cancellation, plus a database exclusion constraint that makes double-booking impossible |
| Check-in and check-out | OTP check-in, condition report before and after with photos |
| Damage, delay, incidents | Automatic flags (late return, rating drop, damage tick), manual reports, human resolution |
| Notifications | In-app: approvals, rejections, waitlist moves, reminders, overdue, incidents |
| Fair usage | Weekly hour cap, active-booking limit, one booking per day on high-demand items, visible priority score |
| Roles | Student, owner, manager, admin with separate screens and server checks |
| Audit trail | `audit_log` table, append-only (a database trigger rejects edits and deletes) |
| Privacy and security | Row Level Security on every table, private storage with short-lived signed URLs, service key only on the server |

### Fairness rules (all visible to the user)

`Priority = purpose weight (course project 50, research 40, personal 20) + waiting time (+2 per day, max +10) - recent use of that resource (2 per hour in the last 30 days, max -30)`

When two requests want one slot, the owner sees both scores. The student sees their own breakdown and, if waitlisted, their rank ("#2 of 3"). The owner can always decide differently, and must give a reason, which is logged.

### AI, used lightly and never as the decision-maker

- Smart match (resource search) and incident summary use Gemini when `GEMINI_API_KEY` is set.
- Without a key, search falls back to keyword matching and the summary falls back to a plain recap.
- AI never approves, rejects, penalises or suspends anyone. Those are always human actions.

## 6. Deploy to Vercel (judge-accessible link)

1. Push this folder to a GitHub repository (the `.gitignore` already excludes `.env.local`).
2. On https://vercel.com choose **Add New > Project**, import the repository.
3. Add the same environment variables as in `.env.local`.
4. Deploy. Then run `npm run seed` locally once (it writes to your Supabase project, so it already applies to the deployed site).
5. Optional: call `https://YOUR-SITE/api/cron` from a free scheduler to send reminders and overdue flags on time. Without it they run whenever anyone opens a page.

## 7. Project layout

```
supabase/schema.sql        tables, RLS policies, triggers, storage bucket
scripts/seed.mjs           demo users and data
src/middleware.ts          session refresh and login redirect
src/lib/                   fairness rules, time helpers, audit/notify, AI, storage, maintenance
src/app/actions/           all server actions (the only code that writes data)
src/app/(app)/             signed-in pages: resources, bookings, staff, incidents, admin
src/components/            small shared UI pieces
```

All writes happen in server actions that first check the signed-in person's role and their relationship to the resource, and only then use the service key. The browser never gets the service key.

## 7a. Branding, responsive layout and speed

- **Your college name:** set `NEXT_PUBLIC_COLLEGE_NAME` and `NEXT_PUBLIC_COLLEGE_SHORT` in `.env.local` (and in Vercel). The header, footer, login, registration and landing page update automatically. Colours live in `tailwind.config.ts`.
- **Public landing page (`/`):** explains the purpose, workflow, features, roles and fairness rules to first-time visitors. Signed-in users are sent straight to Resources.
- **Mobile:** the header becomes a menu button on screens narrower than 1280px; tables scroll sideways inside their card; forms and cards stack on phones.
- **Active page highlight:** the current page is highlighted in the navigation bar (gold underline).
- **Speed tips:**
  - `npm run dev` compiles each page the first time you open it, so it feels slow. For demos run `npm run build && npm start`, or use the deployed Vercel site.
  - Create the Vercel project in the region closest to your Supabase project (Project Settings > Functions > Region).
  - Each page now loads its data in parallel, the signed-in profile is fetched once per request, and a loading skeleton appears instantly while the next page loads.

## 8. Troubleshooting

- **"Invalid login credentials" for demo users:** run `npm run seed` again and check that `.env.local` points at the same Supabase project where you ran `schema.sql`.
- **"relation ... does not exist":** `schema.sql` was not run, or failed partway. Run it again in a new SQL Editor query.
- **Sign-up says to confirm your email:** do Step 3.
- **Photos fail to upload:** confirm the `evidence` bucket exists (Storage tab). `schema.sql` creates it; you can also create a private bucket with that name by hand.
- **Times look shifted:** set `NEXT_PUBLIC_TZ_OFFSET_MIN` to your offset and restart `npm run dev`.
- **`npm run seed` says unknown option `--env-file`:** your Node is older than 20.6. Upgrade Node.

## 9. Known limitations (be upfront with judges)

- In-app notifications only; no email or SMS delivery.
- Bookings are free; deposits are a rule written on the listing, not a payment.
- One college. Resource listings can be hidden or shown but not edited after creation.
- The check-in OTP is stored as plain text in the database (fine for a prototype; hash it for production).
- Photo auto-deletion after a retention period is not implemented.
- Reminders and overdue flags run on page loads or when `/api/cron` is called.

## 10. Disclosure for the submission

This codebase was generated with AI assistance (Claude) and then configured and tested by the team. Libraries used: Next.js, React, Tailwind CSS, `@supabase/ssr`, `@supabase/supabase-js`, IBM Plex fonts via `next/font`. No templates or pre-existing project code. Demo data is fictional. Declare the AI assistance in your submission form, as the rules require.


## Owner-managed manager access

Public registration offers only **Student** and **Resource Owner**. Admin accounts must be provisioned by the platform operator; manager accounts are not available through public signup.

A verified owner can open **Team management** in the dashboard and create an invitation for a manager email. The invitation link is single-use, expires after 7 days, and is stored in the database as a SHA-256 token hash. This project does not include an email delivery provider, so the owner must copy and share the generated link privately. The invited person creates an account or signs in using the invited email address. Pending invitations do not grant access.

The `manager_invitations` and `owner_managers` tables are included in `supabase/schema.sql`. Run the updated schema in Supabase SQL Editor before using team management. A manager can have only one active owner assignment; the owner can revoke access. Permissions for booking decisions, check-in/returns, and incidents are checked by server actions, and resource assignment is limited to the inviting owner's active managers.


### Owner verification flow update

For an existing Supabase database, run `supabase/migration_004_owner_verification_types.sql and `supabase/migration_005_student_college_id_upload.sql`` after the previous migrations. New databases should use the updated `supabase/schema.sql`. Public signup has only Student and Resource Owner. Owners choose College staff, Organisation/business, or Individual and submit the relevant proof for admin review.


## Admin: users, profiles and account status

The admin area has two tabs:

- **Registration requests**: new students (college ID card) and owner applications (documents by owner type) waiting for a decision, plus training proofs. Approve or reject with a reason.
- **All users**: every account, with coloured tags for **role** (student, owner, manager, admin), **owner type**, **Active / Deactivated**, **Verified / Not verified**, **booking suspended**, **request pending or rejected**, and warnings. Search by name, email, college or staff ID, and filter by role and status.

From the list you can open **View profile** (details, uploaded documents, training certificates, bookings, incidents, listings and team, recent activity) or **Deactivate** with a reason.

**Deactivating an account** blocks sign-in (profile flag and Supabase auth ban), cancels the person's open bookings (freeing waitlisted slots), hides an owner's listings and ends manager links, and writes to the audit log. **Reactivate** restores sign-in; an owner shows their listings again themselves. Admin accounts cannot be deactivated from the app, and nobody can deactivate themselves.

## Upgrading from the previous zip

1. In the Supabase SQL Editor run `supabase/migration_006_account_status.sql` once (adds `is_active` and related columns).
2. Run `npm install`, then `npm run seed` again (adds owner-type applicants and one deactivated demo user).
3. Restart the app.

## What changed in this version (speed, feedback and fixes)

**Why pages felt slow:** every page asked Supabase "who is this?" several times before loading its data, and some pages loaded their data one query after another. Now the middleware checks the session once and passes the verified user id to the page, the profile is loaded once per request, and pages load their data in parallel.

**Why buttons felt dead:** only some buttons showed any reaction. Now:
- a gold progress bar runs along the top the moment you click a link or submit a form;
- the clicked navigation link lights up immediately with a small spinner;
- every action button shows a spinner and a "Working..." label, is blocked from double-clicks, and shows a pressed effect on tap. In forms with several buttons (Approve / Reject) only the pressed one spins.

**Tip:** `npm run dev` compiles each page the first time it opens, which is slow by nature. For demos run `npm run build && npm start`, or use the deployed Vercel site. On Vercel, choose the function region closest to your Supabase project.

**Bugs fixed:**
- Manager invitation links redirected new people to the login page, so a new manager could never accept. `/invite/...` is now public.
- "Become an owner" asked only staff questions and never saved the owner type, so the admin saw "Not specified". It now uses the same owner-type form and checks as registration.
- A student whose college ID was pending could not open the owner application; a student whose ID was rejected had no way to send it again. Both fixed on the same page.
- The audit log showed raw codes for manager invitation events. Readable labels added.
- Team management page styling and date formats made consistent.
- Changing an owner back to a student while they still have listings is now refused with an explanation.
- Admin Verify and Role buttons now return you to the page you were on.

## Owner types are shown everywhere

There are three kinds of resource owner, and the app always shows the specific kind instead of just "owner":

| Owner type | Label shown | Colour |
|---|---|---|
| College staff (HOD, lab head, faculty) | **College staff owner** | indigo |
| Organisation or business (makerspace, startup, NGO, shop) | **Organisation owner** | orange |
| Individual who owns equipment | **Individual owner** | green |

You will see the type in: the admin **Registration requests** ("Wants: Organisation owner", button "Approve as Organisation owner"), the approval and notification messages, the **All users** list (tag, owner-type filter and counts), the user profile page, the header role chip, the pending-request banner, and on a resource page next to the name of whoever listed it.

## Sign-in stability fix

Some people were being sent back to the login page after the admin approved them, and approved owners could not get in. Changes:

- The signed-in person's profile is now loaded by their verified id with the service role. A row-level-security or expired-token hiccup inside a page can no longer make a valid session look "logged out".
- If the middleware header is ever missing, the app asks Supabase Auth directly instead of redirecting to login.
- A temporary Supabase or network error in the middleware no longer counts as "not signed in".
- Sign out now ends only this browser's session (it used to end the person's sessions on every device).
- The login and register pages send an already signed-in person straight into the app.

**Testing tip:** cookies are shared by every tab of one browser. If you sign in as the admin in the same browser where the student or owner is signed in, the student or owner is replaced by the admin session. Use a second browser, or a private window, for the second account. After updating, sign out and sign in once so old cookies are replaced.


## Training requests (owner to admin)

Only the admin can create trainings, but an owner may need one that does not exist yet (for example "Laser cutter safety" for a laser cutter they want to share).

1. Owner opens **Request training**, enters the training name and which item it is for.
2. The admin sees it under **Admin > Training requests from owners**, may edit the name, then **approves** (the training is created and appears in the list) or **rejects with a reason**.
3. The owner is notified. After approval the owner ticks the training as required when listing the resource, so users must upload an approved certificate before booking it.
4. Every request and decision is written to the audit log.

Upgrading: run `supabase/migration_007_training_requests.sql` once (or re-run `schema.sql`), then `npm run seed`.
