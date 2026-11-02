# UlpaQuiz (אולפה-קוויז) — Project Overview & Architecture Guide

> **Quick Summary:** UlpaQuiz is a daily Halacha learning & quiz web platform tailored for Israeli girls' high schools (Ulpanot). Students answer one question every school day, earn points, achieve streaks, and compete on leaderboards. School coordinators and teachers use an Admin Panel to manage content, student approvals, classes, and prizes.

---

## 1. Environments & Deployment Targets

| Attribute | Production | Staging |
|---|---|---|
| **URL** | [https://ulpaquiz.web.app](https://ulpaquiz.web.app) | [https://ulpaquiz-staging.web.app](https://ulpaquiz-staging.web.app) |
| **Git Branch** | `main` | `staging` |
| **Firebase Project** | `ulpaquiz` | `ulpaquiz-staging` |
| **Scope** | Single School: **אולפנת שבות רחל** (250+ active students) | **Multi-School Architecture** (שבות רחל, אבן שמואל, yeshivat-demo, Head Office portal) |
| **Env File** | `.env.production` | `.env.staging` (local dev uses `.env.local`) |

> [!IMPORTANT]
> **Branching Policy:** `staging` diverges significantly from `main` to support multi-tenancy. **Never run a full `git merge` between `main` and `staging`**. Bug fixes and specific features must be cherry-picked.

---

## 2. Core Architecture & Tech Stack

* **Frontend:** React 18 + TypeScript + Vite.
* **Styling:** Tailwind CSS v4.
* **Icons & Animation:** `lucide-react`, `motion`, `canvas-confetti`.
* **Backend / Database / Auth:** Pure Firebase client-side architecture (Firebase Authentication + Cloud Firestore).
* **Calendar & Jewish Law Logic:** `@hebcal/core` automatically computes Hebrew dates, Parshat Hashavua, Shabbat, and Yom Tov lockouts.
* **AI Quiz Generation:** Google Gemini API (`@google/genai`) and `mammoth` (Word document parser) integrated to generate daily Halacha questions directly from source texts.
* **Zero Backend in Production:** Firebase Hosting serves the compiled static files (`dist/`). The Node/Express `server.ts` is strictly a local dev utility and is **never** deployed to production.

---

## 3. Modular Codebase Structure

Recently refactored for clean separation of concerns and high maintainability:

```
src/
├── App.tsx                          # Auth lifecycle, user state, route resolution
├── types.ts                         # Core shared interfaces (Student, DailyHalacha, etc.)
│
├── components/
│   ├── AdminPanel.tsx               # Admin shell, state container, tab orchestration
│   ├── admin/
│   │   ├── aiHelpers.ts             # AI question parsing & validation helpers
│   │   ├── hebrewCalendarUtils.ts   # Hebcal wrappers
│   │   ├── prizeIcons.tsx           # Prize milestone icons
│   │   └── tabs/                    # Individual admin tabs:
│   │       ├── StudentsTab.tsx      # Student registry, approval & editing
│   │       ├── ResultsTab.tsx       # Daily participation analytics
│   │       ├── HalachotTab.tsx      # Daily quiz questions editor & AI generator
│   │       ├── HebrewDateTab.tsx    # Calendar-mapped quiz planner
│   │       ├── PrizesTab.tsx        # Milestone & reward configuration
│   │       ├── ClassesTab.tsx       # Class management
│   │       ├── ManagersTab.tsx      # School manager access management
│   │       ├── DedicationTab.tsx    # Daily sponsorship / dedication message
│   │       └── CollabTab.tsx        # Question suggestions & feedback from students
│   ├── Dashboard.tsx                # Student home screen (stats, leaderboard, quiz CTA)
│   ├── EntryScreen.tsx              # Login & landing screen
│   ├── QuizModal.tsx                # Active quiz experience & submission
│   ├── Leaderboards.tsx             # Student and class rankings
│   ├── RegisterPage.tsx             # Student signup flow
│   └── MilestoneModal.tsx           # Celebratory prize milestone popups
│
├── lib/
│   ├── api.ts                       # Single-line barrel export (`export * from './api/index'`)
│   ├── api/                         # Domain-driven API services:
│   │   ├── students.ts              # Student CRUD & registration
│   │   ├── halachot.ts              # Quiz content management
│   │   ├── leaderboard.ts           # Scoreboards & public aggregates
│   │   ├── prizes.ts                # Milestones & prize claims
│   │   ├── classes.ts               # Class additions & deletions
│   │   ├── managers.ts              # Coordinator management
│   │   ├── suggestions.ts           # Student-submitted questions & feedback
│   │   └── schools.ts               # Multi-tenant school configuration
│   ├── authService.ts               # Firebase Auth helpers
│   ├── firebaseClient.ts            # Firebase app init & Firestore instance
│   └── quizSchedule.ts              # Shabbat/Yom Tov scheduling & lockout rules
│
└── data/
    ├── seedData.ts                  # Default milestones & initial seed fixtures
    └── yearHalachot.json            # Curated curriculum of daily questions
```

---

## 4. Firestore Data Collections

| Collection | Purpose | Read/Write Access |
|---|---|---|
| `students` | Full private student profile (points, grade, class, submissions) | Students (own record), Managers & Super Admin |
| `publicStudents` | Sanitized public scores for leaderboards (prevents quota drain) | Public / All authenticated users |
| `halachot` | Daily quiz questions, options, correct answers, explanations | Public read; Managers write |
| `managers` | Registered coordinators and their assigned schools | Managers & Super Admin |
| `settings/classes` | Approved classes for the active school | Authenticated read; Manager write |
| `settings/prizes` | Milestone criteria and rewards | Authenticated read; Manager write |
| `questionSuggestions` | Questions proposed by students | Students create; Managers review |
| `questionFeedback` | Student reports/notes on quiz questions | Students create; Managers review |
| `schools/{id}` | Multi-tenant school settings (*staging only*) | Super Admin / School Managers |

---

## 5. Critical System Invariants (DO NOT BREAK)

1. **Shabbat & Yom Tov Lockout:** Quizzes are automatically locked during Shabbat and Jewish holidays using `@hebcal/core` in `quizSchedule.ts`. Never disable or bypass this validation.
2. **Server-Side Validation:** Firestore security rules enforce submission integrity, date eligibility, and user identity server-side. Never rely solely on client-side logic.
3. **Class API Pattern:** `addClassApi` and `deleteClassApi` must always read the raw stored list (`readStoredClassList()`). **Never call `fetchClassesApi()` internally inside these functions**, as doing so re-merges `DEFAULT_CLASSES` and undeletes deleted classes.
4. **AdminPanel Double-Write Loop Prevention:** In `AdminPanel.tsx`, the class synchronization `useEffect` dependency array must be `[classesLoaded, students]` (or `[classesLoaded, students, currentSchoolId]` in staging). **`classesList` must NEVER be included in this dependency array**.
5. **Hosting-Only Deploys:** All build/deploy scripts strictly target `--only hosting`. Firestore security rules and database contents are never pushed automatically.

---

## 6. Daily Developer Commands

Always run commands from the project root (`/home/skilead770/ulpaquiz`):

```bash
# 1. Type-check (must pass with 0 errors before any commit)
npm run lint

# 2. Local development server (uses .env.local)
npm run dev

# 3. Production build & deployment (single-school: Ulpanat Shvut Rachel)
npm run build:firebase
npm run deploy:prod

# 4. Staging build & deployment (multi-school testbed)
npm run build:staging
npm run deploy:staging
```

---

## 7. Current Git Workspace Status

* **Current checked-out branch:** `cloudshell`
* **Latest commits on `origin/main`:** Contains the full modular refactoring, `GEMINI.md`, and `CLAUDE.md`.
* **Latest commits on `origin/staging`:** Contains the multi-school school builder, Head Office portal, and gender alignment.

---
*Created on 2026-11-02 for Cloud Shell IDE.*
