# Med-Appt-Tracker

Hebrew (RTL) PWA for managing personal medical care: medications, doses, appointments, adherence tracking, and Web Push reminders. Single-user-per-account; the owner's account is `inbalmg@gmail.com`.

Built as a final project for a course on **digital tools for organisations and integrating AI into business processes**, so features are weighed partly on whether they demonstrate that theme.

## ⚠️ Read this first: there are two repos

| Repo | Status |
|---|---|
| **`inbalmg/Med-Appt-Tracker`** | **The real one.** Netlify builds from it. Work here. |
| `inbalmg/pill-and-appt-mate` | **Archive.** An older copy. Nothing deploys from it. |

They look nearly identical. Confusing them cost hours once and broke the live site. Check `git remote -v` before assuming.

Local clones: `C:\AI_Projects\Med-Appt-Tracker` (live) and `C:\AI_Projects\pill-and-appt-mate` (archive).

## Live services

| | |
|---|---|
| Site | https://med-appt-tracker.netlify.app |
| Netlify project | `med-appt-tracker` (site id `a650b78a-3127-480c-9a6b-03a3a7447446`) — env vars set in its dashboard, **not** from `.env` |
| Supabase project | `tuvoumlrewbedlnloznx` ("inbalmg's Project") |
| Deploys | Netlify auto-builds `main`. Branch deploys are **off**, so a pushed branch gets no preview URL — open a PR to get a deploy preview. |

An older Supabase project `mjdcjlmgtcafvhhyuqmq` belonged to Lovable and is **not accessible**. If a URL or key with that ref turns up anywhere, it's a stale artifact — remove it.

## Stack

Vite 5 · React 18 · TypeScript · shadcn/ui (Radix) · Tailwind · react-router-dom 6 · @tanstack/react-query · Supabase (Postgres + Auth + Edge Functions) · custom service worker PWA · Vitest.

`vite-plugin-pwa` was removed deliberately — `public/sw.js` is hand-written and registered in `src/main.tsx`. Don't reintroduce the plugin; it would generate its own `sw.js` and silently drop the push handler.

## Running it

```sh
npm install
cp .env.example .env    # then fill in the values (see below)
npm run dev             # http://localhost:8080
```

Also: `npm run build`, `npm run preview`, `npm run lint`, `npm run test` (Vitest).

**`.env` is gitignored and is NOT in the repo.** It holds `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` — get them from Supabase → Project Settings → API. Without it the app renders a **blank page with no console error** (the Supabase client throws before React mounts). If you ever see a blank page, check `.env` exists before debugging anything else. Note git deletes it when switching to a branch from before it was untracked.

## Layout

```
src/
  pages/          Index.tsx (the whole app; tabs are internal), Auth.tsx, NotFound.tsx
  components/     business components + components/ui/ (shadcn primitives)
  hooks/          useAuth, useSupabaseData, useNotifications, useHideOnScroll
  lib/            schedule.ts, adherence.ts (+ adherence.test.ts), utils, uuid
  integrations/supabase/   client.ts + types.ts (both generated — regenerate, don't hand-edit)
supabase/
  migrations/     schema
  functions/      push-subscribe, send-notifications (Deno)
```

Routes: `/auth` (public), `/` (protected), `*`. The four tabs — יומן / תורים / תרופות / מעקב — all live inside `Index.tsx`.

## Data model

`medications`, `appointments`, `completions`, `arrivals`, `pending_reminders`, `push_subscriptions`, `notification_log`, `vapid_keys`.

Every table has RLS on. User tables and `pending_reminders` are scoped by `auth.uid() = user_id`. `vapid_keys`, `push_subscriptions`, and `notification_log` have **RLS enabled with no policy on purpose** — only the edge functions touch them, via the service role, which bypasses RLS. That's intended; don't "fix" it by adding policies.

### Non-obvious things that will bite you

- **Un-taking a dose deletes the row.** `completions` has no `completed: false` state, so a missed dose and a dose that was never scheduled look identical. Any adherence denominator must come from the schedule (`lib/schedule.ts`), never from counting `completions`. This is why `getMedInstancesForDate` exists.
- **`appointments.time` and `completions.time` are TEXT** (`"09:40"`), not a time type. The client compares them as strings.
- **`medications.start_date`/`end_date` are DATE**, and the client does string comparison on `yyyy-MM-dd`.
- **`dosage` is free text** (`"20mg"`). Nothing parses it; you cannot derive a pill count from it.
- **Adding a column to `medications` touches 5 places**: `src/types/index.ts`, a migration, `integrations/supabase/types.ts`, `useSupabaseData.ts` (**three** payload sites — `rowToMedication`, the single upsert, and the bulk import), and `AddMedicationForm.tsx`. Miss the import payload and bulk imports silently drop the field.
- The deployed schema was originally created by hand and had drifted from the migration files (wrong column types, missing UNIQUE constraints, missing `ON DELETE CASCADE`). It has been reconciled — but if something behaves oddly, verify the live schema rather than trusting the migrations.

## Notifications

Client (`useNotifications.ts`) computes reminders for today + tomorrow and upserts them into `pending_reminders` on `(user_id, notification_key)`. `trigger_at = dose time − reminderMinutes`. A pg_cron job (`check-reminders`, every minute) POSTs `{"source":"cron"}` to `send-notifications`, which pushes anything due and marks it `sent`.

- **`sent` means "we pushed it", not "the user acted on it".** There is no acknowledgement signal anywhere, and no link between `pending_reminders` and `completions` (only a string convention in `notification_key`).
- Both edge functions run with `verify_jwt = false` and derive the caller from the `Authorization` bearer token themselves. **Never take a user id from the request body** — that reopens the cross-user leak that was fixed here.
- Delivery is **Web Push only**. No email, no SMS, no such dependency in the project.
- **Custom notification sounds are impossible** from web push — the `sound` option was never implemented by any browser. The sound comes from the Android notification channel. The only real lever is installing the PWA to the home screen, which gives it its own channel the user can configure. Vibration *is* controllable, in `public/sw.js`.
- `send-notifications` deletes sent reminders older than 2 days, so per-reminder state doesn't survive.

## Testing and verification

`src/lib/adherence.test.ts` has 16 tests covering the edge cases: doses not yet due today, expired `endDate`, weekly/interval frequencies, streak behaviour. Run `npm run test`.

Things learned the hard way when verifying UI:

- **Measure rendered glyphs, not element boxes.** `getBoundingClientRect()` on a `flex-1` element reports a box far wider than the visible text and produces false overlaps. Use `document.createRange()` + `selectNodeContents`.
- **Radix tabs need real pointer events.** `el.click()` doesn't switch them; dispatch `pointerdown`/`mousedown`/`pointerup`/`mouseup`/`click`.
- **`DateStrip` renders 61 days** (30 either side) and scrolls horizontally, so the first buttons in the DOM are a month back. Select by `[data-date="yyyy-MM-dd"]`, not by index.
- Test account `demo@example.com` / `demo1234` exists with seeded data. **It's disposable and should be deleted before any real demo.** Deleting the user now cascades its data.

## Decisions already made (don't redo the analysis)

- **The floating + button stays centred.** Corners sound better but measure worse: across all four tabs at rest, centre covers 3 text items and blocks 3 tap targets; left corner 6 and 5 (including the dose checkbox); right corner 10 and 2. It hides while scrolling down (`useHideOnScroll`). A floating button inherently overlaps content at some rest positions — that's the tradeoff, accepted knowingly.
- **Google sign-in was removed**, not migrated. It used to route OAuth through Lovable's service. Email/password talks to Supabase directly. Supabase supports native Google OAuth if it's ever wanted.

## Known gaps

- **No "forgot password" flow.** A user who forgets their password is locked out of their medical data with no recovery path in the app; resets must be done from the Supabase dashboard. This is the most user-facing gap.
- **Leaked-password protection is off** in Supabase (Authentication → Policies) — one toggle.
- The full push path on a real device (bell → permission → notification arriving) has been verified once, on Android/Chrome, for `inbalmg@gmail.com`. iOS requires install-to-home-screen plus iOS 16.4+.
- Lovable's anon keys remain in git history (`pill-and-appt-mate` commit `4e918e0`). They're anon keys, public by design, and RLS is what actually protects the data — but the repo is public.

## Ideas that were scoped but not built

| Idea | Cost |
|---|---|
| **Natural-language entry** ("אקמול 500 שלוש פעמים ביום" → structured record) | ~half a day. Validation, edge-function skeleton, and save path all already exist; reuse the validators in `ImportDataDialog.tsx` (extract them to `src/lib/importValidation.ts` first) and pre-fill `AddMedicationForm` for human approval. **Needs an AI API key in Supabase → Edge Functions → Secrets** — there is none today, and it costs money. |
| **Stock depletion prediction** | ~half a day. `getMedInstancesForDate` already does the hard part; a forward loop is ~10 lines. Needs a `stock_count` column and a decision on whether stock decrements on each `toggleCompletion`. No external dependency. |
| **Document extraction** (photo/PDF → medications) | Much harder. **Supabase Storage is completely unused** — no bucket, no upload path, no base64/PDF handling. The only file input reads `file.text()`, which breaks on an image. |
| **Reminder escalation** (notify a contact if a dose isn't confirmed) | Expensive: four things are missing — a contact field (there is **no profiles table and no settings UI at all**), a delivery channel, an acted-on signal, and a link between reminders and completions. |

## Conventions

- Commit messages are plain sentences, no `feat:`/`fix:` prefixes.
- All UI text is Hebrew; the app is `dir="rtl"` throughout.
- Don't commit `.env`. Don't put secrets in migrations — the cron migration used to carry a hardcoded JWT and no longer needs one.
