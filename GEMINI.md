# UlpaQuiz — Project Context for Gemini

## What this app is

UlpaQuiz is a daily Halacha (Jewish law) quiz platform for Israeli girls' schools (ulpanot).
Students answer one question per day, accumulate points, and compete on class/school leaderboards.
School managers use an admin panel to manage quiz content, students, classes, and prizes.

- **Production**: https://ulpaquiz.web.app — live with 250+ students (school: שבות רחל)
- **Staging**: https://ulpaquiz-staging.web.app — multi-school architecture in development

---

## Tech stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS v4
- **Database / Auth / Hosting**: Firebase (Firestore, Firebase Auth, Firebase Hosting)
- **Hebrew calendar**: `@hebcal/core` for Shabbat, Yom Tov, and parsha logic
- **Icons**: `lucide-react`

**No separate backend in production.** Firebase Hosting serves the `dist/` folder as a static SPA. The `server.ts` Express file is for local development only and is not deployed.

---

## Git branches

| Branch | Purpose | Firebase project |
|---|---|---|
| `main` | Production — single school | `ulpaquiz` |
| `staging` | Multi-school architecture | `ulpaquiz-staging` |

`staging` diverges significantly from `main`. Cherry-pick specific fixes between branches — do not do a full merge.

---

## Essential commands

```bash
npm run lint             # TypeScript type check — always run before committing
npm run build:firebase   # Production build (.env.production)
npm run build:staging    # Staging build (.env.staging)
npm run deploy:prod      # Build + deploy hosting to production Firebase project
npm run deploy:staging   # Build + deploy hosting to staging Firebase project
npm run dev              # Local dev server (uses .env.local → ulpaquiz-staging)
```

**Deploy commands use `--only hosting` — they never touch Firestore data or rules.**
Never deploy to production without explicit user confirmation.

---

## Folder structure (main branch)

```
src/
├── App.tsx                    # Root component: auth flow, data loading, routing
├── types.ts                   # All shared TypeScript types
│
├── components/
│   ├── AdminPanel.tsx          # Admin shell: shared state, tab nav (~3000 lines)
│   ├── admin/
│   │   ├── aiHelpers.ts        # AI response parsing utilities
│   │   ├── hebrewCalendarUtils.ts
│   │   ├── prizeIcons.tsx
│   │   └── tabs/               # One component per admin tab
│   │       ├── StudentsTab.tsx
│   │       ├── ResultsTab.tsx
│   │       ├── HalachotTab.tsx  # Quiz content editor + AI generation
│   │       ├── HebrewDateTab.tsx
│   │       ├── PrizesTab.tsx
│   │       ├── ClassesTab.tsx
│   │       ├── ManagersTab.tsx
│   │       ├── DedicationTab.tsx
│   │       └── CollabTab.tsx    # Question suggestions + feedback
│   ├── Dashboard.tsx
│   ├── EntryScreen.tsx
│   ├── QuizModal.tsx
│   ├── Leaderboards.tsx
│   ├── RegisterPage.tsx
│   ├── Navbar.tsx
│   ├── MilestoneModal.tsx
│   ├── SuggestQuestionModal.tsx
│   └── QuestionFeedbackModal.tsx
│
├── lib/
│   ├── api.ts                  # Barrel re-export only (1 line: export * from './api/index')
│   ├── api/                    # Domain-split API modules
│   │   ├── index.ts            # Re-exports everything
│   │   ├── core.ts             # Auth token, fetch helpers, publicStudents cache
│   │   ├── students.ts         # Student CRUD + registration
│   │   ├── halachot.ts         # Quiz content CRUD + AI generation
│   │   ├── leaderboard.ts
│   │   ├── prizes.ts           # Milestones, dedication, calendar annotations
│   │   ├── invitations.ts
│   │   ├── managers.ts
│   │   ├── classes.ts          # Class management
│   │   ├── schools.ts          # School config
│   │   └── suggestions.ts      # Question suggestions + feedback
│   ├── authService.ts
│   ├── firebaseClient.ts       # Firebase app init + db/auth exports
│   ├── quizSchedule.ts         # Shabbat/Yom Tov availability (Hebcal)
│   ├── config.ts               # VITE_ env var exports
│   └── gmailValidator.ts
│
├── data/
│   ├── seedData.ts             # Default prize milestones, seed students/halachot
│   └── yearHalachot.json       # Full year of quiz content
│
└── types/
    └── tenant.ts               # School/multi-tenant types (staging)
```

---

## Firestore data model

| Collection | Contents |
|---|---|
| `students` | Student records: status, points, class, submissions |
| `publicStudents` | Public summaries for leaderboard (synced from students) |
| `halachot` | Daily quiz questions and answers |
| `managers` | Manager emails and roles |
| `settings/classes` | Class list for the main school (שבות רחל) |
| `settings/prizes` | Prize milestone configuration |
| `schools/{id}` | School config documents (staging multi-school) |
| `questionSuggestions` | Student-submitted question ideas |
| `questionFeedback` | Student feedback on existing questions |

---

## Auth & access control

- **Super admin**: email in `VITE_SUPER_ADMIN_EMAIL` env var — bypasses all checks
- **Manager**: email in `managers` Firestore collection — manages their school
- **Student**: approved record in `students` collection
- `canManageSchool()` checks super admin first, then `school.adminEmails`
- `fetchStudents()` grants full list to managers and super admin; others get only their own record

---

## Critical invariants — never break these

1. **Shabbat/Yom Tov**: Quiz is disabled on Shabbat and Yom Tov via `quizSchedule.ts` (Hebcal). Test edge cases when changing calendar logic.

2. **Submission security**: Firestore security rules validate quiz submissions server-side (ownership, date eligibility, score integrity). Never weaken them client-side.

3. **Class API pattern**: `addClassApi` and `deleteClassApi` call `readStoredClassList()` to read the raw Firestore list — they must NOT call `fetchClassesApi()` internally. Calling `fetchClassesApi()` merges DEFAULT_CLASSES into the result and re-inserts deleted classes.

4. **AdminPanel sync effect**: The class sync `useEffect` must have deps `[classesLoaded, students]` (or `[classesLoaded, students, currentSchoolId]` in staging). `classesList` must NOT be in the dep array — it causes an infinite double-write loop.

5. **Hosting-only deploys**: All production deploys use `--only hosting`. Firestore rules and data are never deployed without explicit confirmation from the user.

---

## Environment files

| File | Project | Committed? |
|---|---|---|
| `.env.local` | `ulpaquiz-staging` (local dev) | No (gitignored) |
| `.env.production` | `ulpaquiz` (production) | Yes |
| `.env.staging` | `ulpaquiz-staging` | Yes |

---

## Staging multi-school additions

These files exist only on the `staging` branch:

| File | Purpose |
|---|---|
| `src/types/tenant.ts` | `School` type, `DEFAULT_SCHOOLS` list |
| `src/context/SchoolContext.tsx` | Multi-school React context, auto-seeds schools to Firestore |
| `src/lib/gender.ts` | Hebrew gender text (feminine/masculine) |
| `src/components/admin/HeadOfficePortal.tsx` | Cross-school head-office view |
| `src/components/admin/SchoolsManagerTab.tsx` | School CRUD admin UI |

Active schools on staging: `shvut-rachel` (אולפנת שבות רחל), `even-shmuel` (אולפנת אבן שמואל), `yeshivat-demo` (demo).

Schools in `DEFAULT_SCHOOLS` are auto-seeded to Firestore on first load. After that, Firestore is the source of truth — use the admin UI to edit, not the code.
