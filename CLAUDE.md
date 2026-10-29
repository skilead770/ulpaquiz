# UlpaQuiz — AI Assistant Onboarding

## What this app is

UlpaQuiz is a daily Halacha quiz platform for Jewish girls' schools (ulpanot) in Israel.
Students answer one question per day, accumulate points, and compete on leaderboards.
Managers/admins manage quiz content, students, classes, and prizes.

**Production**: https://ulpaquiz.web.app (250+ active students, שבות רחל)
**Staging**: https://ulpaquiz-staging.web.app (multi-school architecture)

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Backend/DB | Firebase (Firestore, Auth, Hosting) |
| Calendar | `@hebcal/core` for Shabbat/Yom Tov/parsha logic |
| Icons | `lucide-react` |

**There is no separate backend server in production.** Firebase Hosting serves the `dist/` SPA. The Express `server.ts` is a local dev tool only.

---

## Branches

| Branch | Purpose | Firebase project |
|---|---|---|
| `main` | Production — single school (שבות רחל) | `ulpaquiz` |
| `staging` | New multi-school architecture | `ulpaquiz-staging` |

`staging` is a significant divergence from `main` — it adds multi-school/multi-tenant support. Do NOT do a full `git merge main` into staging; cherry-pick specific fixes instead.

---

## Key scripts

```bash
npm run lint             # TypeScript check (tsc --noEmit) — run before every commit
npm run build:firebase   # Production build (uses .env.production)
npm run build:staging    # Staging build (uses .env.staging)
npm run deploy:prod      # build:firebase + firebase deploy --only hosting --project prod
npm run deploy:staging   # build:staging + firebase deploy --only hosting --project staging
npm run dev              # Local Express dev server (tsx server.ts) — uses .env.local
```

**Always run `npm run lint` before deploying.** Never deploy Firestore rules or data without explicit user approval.

---

## Source structure (main branch)

```
src/
├── App.tsx                          # Root: auth, data loading, routing
├── main.tsx                         # Entry point
├── types.ts                         # Shared types (Student, DailyHalacha, etc.)
├── index.css                        # Global styles
│
├── components/
│   ├── AdminPanel.tsx               # Admin shell: shared state, tab nav, shared modals (~3000 lines)
│   ├── admin/                       # Admin sub-components
│   │   ├── aiHelpers.ts             # AI response parsing utilities
│   │   ├── hebrewCalendarUtils.ts   # Hebrew calendar helpers
│   │   ├── prizeIcons.tsx           # renderAdminPrizeIcon (also re-exported from AdminPanel)
│   │   └── tabs/                    # One file per admin tab
│   │       ├── StudentsTab.tsx      # Student list, approve/reject/edit
│   │       ├── ResultsTab.tsx       # Daily quiz results & status
│   │       ├── HalachotTab.tsx      # Quiz content editor, AI generation, Google Drive import
│   │       ├── HebrewDateTab.tsx    # Hebrew calendar quiz editor
│   │       ├── PrizesTab.tsx        # Prize milestones
│   │       ├── ClassesTab.tsx       # Class management
│   │       ├── ManagersTab.tsx      # Manager management
│   │       ├── DedicationTab.tsx    # Daily dedication message
│   │       └── CollabTab.tsx        # Question suggestions + feedback
│   ├── Dashboard.tsx                # Student dashboard (leaderboard, score, quiz button)
│   ├── EntryScreen.tsx              # Login / welcome screen
│   ├── QuizModal.tsx                # Quiz interaction modal
│   ├── Leaderboards.tsx             # Leaderboard display
│   ├── RegisterPage.tsx             # Student registration
│   ├── Navbar.tsx                   # Navigation bar
│   ├── MilestoneModal.tsx           # Prize milestone celebration
│   ├── SuggestQuestionModal.tsx     # Student question suggestion
│   └── QuestionFeedbackModal.tsx    # Student question feedback
│
├── lib/
│   ├── api.ts                       # Barrel: export * from './api/index' (1 line)
│   ├── api/                         # Domain-split API modules
│   │   ├── index.ts                 # Re-exports all modules
│   │   ├── core.ts                  # Auth token, shared fetch helpers, publicStudents cache
│   │   ├── students.ts              # Student CRUD + registration
│   │   ├── halachot.ts              # Quiz content CRUD + AI generation
│   │   ├── leaderboard.ts           # Leaderboard fetch
│   │   ├── prizes.ts                # Milestones, dedication, calendar annotations
│   │   ├── invitations.ts           # Invitation codes
│   │   ├── managers.ts              # Manager CRUD
│   │   ├── classes.ts               # Class management
│   │   ├── schools.ts               # School config (used by staging multi-school)
│   │   └── suggestions.ts           # Question suggestions + feedback
│   ├── authService.ts               # Firebase Auth helpers
│   ├── firebaseClient.ts            # Firebase app init + Firestore/Auth exports
│   ├── firebaseAdmin.ts             # Admin SDK (server-side only)
│   ├── quizSchedule.ts              # Shabbat/Yom Tov availability, Hebcal logic
│   ├── schoolContext.tsx            # Multi-school context (staging only — on main this is a stub)
│   ├── config.ts                    # VITE_ env var exports (SUPER_ADMIN_EMAIL, etc.)
│   └── gmailValidator.ts            # Gmail address validation
│
├── data/
│   ├── seedData.ts                  # DEFAULT_PRIZE_MILESTONES, INITIAL_STUDENTS/HALACHOT
│   └── yearHalachot.json            # Full year of quiz content
│
├── assets/
│   └── logo.ts                      # Logo URL
│
└── types.ts                         # All shared TypeScript types
```

---

## Firestore collections

| Collection | Contents | Who writes |
|---|---|---|
| `students` | Student records (status, points, submissions) | API functions only |
| `publicStudents` | Public summaries for leaderboard | Synced from `students` |
| `halachot` | Daily quiz content | Admin panel |
| `managers` | Manager emails + roles | Admin panel |
| `settings/classes` | Class list for שבות רחל | Admin panel |
| `settings/prizes` | Prize milestones | Admin panel |
| `submissions/{studentId}_{date}` | Quiz answers | Student quiz submit |
| `schools/{id}` | School config (staging multi-school) | Admin panel |
| `questionSuggestions` | Student-submitted question ideas | Students |
| `questionFeedback` | Student feedback on questions | Students |

**Never modify Firestore data directly in code without Firestore rules validation.**

---

## Auth & roles

- **Super admin**: `VITE_SUPER_ADMIN_EMAIL` env var — full access to everything
- **Manager**: email in `managers` Firestore collection — manages their school
- **Student**: registered in `students` collection with `status: 'approved'`
- `canManageSchool()` checks super admin first, then `school.adminEmails`
- `fetchStudents()` checks managers collection; super admin bypasses it directly

---

## Key invariants — do not break

1. **Shabbat/Yom Tov**: Quiz is disabled on Shabbat and Yom Tov. Logic is in `quizSchedule.ts` using Hebcal. Test calendar edge cases when changing.
2. **Submission validation**: Firestore rules validate quiz submissions server-side. Never weaken them.
3. **Class management**: `deleteClassApi` / `addClassApi` read raw stored list (`readStoredClassList`) — do NOT call `fetchClassesApi` inside them (causes DEFAULT_CLASSES re-insertion bug).
4. **Sync effect**: AdminPanel's class sync useEffect deps are `[classesLoaded, students, currentSchoolId]` — `classesList` must NOT be in deps (causes double-write loop).
5. **`--only hosting`**: All deploy commands deploy hosting only. Never deploy Firestore rules or data without explicit approval.

---

## Environment files

| File | Used for |
|---|---|
| `.env.local` | Local dev → `ulpaquiz-staging` project |
| `.env.production` | Production build → `ulpaquiz` project |
| `.env.staging` | Staging build → `ulpaquiz-staging` project |

`.env.production` and `.env.staging` are committed (contain non-secret project IDs and super admin email). `.env.local` is gitignored.

---

## Staging multi-school additions

`staging` branch adds these files not present in `main`:

```
src/
├── types/tenant.ts          # School type, DEFAULT_SCHOOLS list, SchoolBranding
├── context/SchoolContext.tsx # Multi-school React context, Firestore school seeding
├── lib/gender.ts            # Hebrew gender text (תלמידות vs תלמידים)
├── components/admin/
│   ├── HeadOfficePortal.tsx  # Head-office cross-school management
│   └── SchoolsManagerTab.tsx # School CRUD admin UI
```

Schools defined in `DEFAULT_SCHOOLS` are auto-seeded to Firestore on first load. After seeding, Firestore is the source of truth — edit via admin UI, not code.

Current schools: `shvut-rachel` (שבות רחל), `even-shmuel` (אבן שמואל), `yeshivat-demo`.
