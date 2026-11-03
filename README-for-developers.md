# UlpaQuiz — Developer Onboarding & Architecture Guide

Welcome to **UlpaQuiz** ("אולפнахידון" / "ישיבחידון"), a daily Halacha learning and quiz platform for Israeli religious high schools (Ulpanot and Yeshivot), built around the teachings of Rabbi Mordechai Eliyahu zt"l for the Hebrew year 5787 (תשפ"ז).

---

## 1. Environments, Branches, & Live URLs

| Environment | Git Branch | Firebase Project ID | Live URL | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Production** | `main` | `ulpaquiz` | https://ulpaquiz.web.app | Live single-school production environment (Ulpanat Shvut Rachel). **Never deploy or mutate without explicit approval.** |
| **Staging** | `staging` | `ulpaquiz-staging` | https://ulpaquiz-staging.web.app | Active testing & multi-tenant (multi-school) environment. |
| **Head Office (Staging)** | `staging` | `ulpaquiz-staging` | https://ulpaquiz-staging.web.app/?portal=headoffice | Super Admin portal (`skilead770@gmail.com`) for cross-school management. |

### Current Branch Divergence (`main` vs `staging`)
Before merging between `main` and `staging`, be aware of the two tracks of work:
1. **`staging` (Multi-Tenant Track)**:
   - Adds full multi-school support (`src/contexts/SchoolContext.tsx`, `src/types/tenant.ts`, `src/lib/gender.ts`).
   - Adds the Super Admin **Head Office Portal** (`src/components/admin/HeadOfficePortal.tsx`) and **Schools Manager** (`src/components/admin/SchoolsManagerTab.tsx`) with client-side compressed logo uploads and automatic `/managers/{email}` sync.
2. **`main` (Modular Refactoring Track)**:
   - Splits `src/lib/api.ts` into domain modules under `src/lib/api/` (`students.ts`, `halachot.ts`, `managers.ts`, `settings.ts`, `feedback.ts`, etc.).
   - Splits `src/components/AdminPanel.tsx` into tab components under `src/components/admin/tabs/`.
   - When merging `staging` into `main`, port the `schoolId` filtering and `SchoolsManagerTab` into the modular files on `main`.

---

## 2. Tech Stack & Architecture

- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS v4, Lucide React icons, Motion (`motion/react`), Recharts.
- **Jewish Calendar Engine**: `@hebcal/core` for Hebrew dates, Shabbat/Yom Tov detection, Parshat HaShavua, and advance quiz eligibility.
- **Hosting & Backend**:
  - **Firebase Hosting** serves `dist/` as a static Single-Page Application (`firebase.json` is the deployment source of truth).
  - **Firebase Authentication** handles Google Sign-In (restricted to verified `@gmail.com` accounts).
  - **Cloud Firestore** is accessed directly from the browser via the Firebase Web SDK, protected by strict declarative security rules in `firestore.rules`.
  - *Note*: `server.ts` is an Express + SQLite local fallback from early prototyping and is **not** deployed to Firebase Hosting.

---

## 3. Repository Structure

```text
├── firebase.json                 # Firebase Hosting & Firestore configuration
├── firestore.rules               # Production-grade Firestore security rules
├── firestore.indexes.json        # Firestore composite indexes
├── AGENTS.md                     # Mandatory engineering & safety rules for AI agents and devs
├── HANDOFF.md                    # Historical operations & migration handoff notes
├── scripts/                      # Admin CLI utilities (backfills, seeding, backups)
└── src/
    ├── App.tsx                   # Root SPA shell, routing state, Auth & Quiz lifecycle
    ├── firebase.ts               # Firebase SDK initialization (env-driven with fallbacks)
    ├── contexts/
    │   └── SchoolContext.tsx     # Multi-tenant school resolution (?school=<id>, localStorage, profile)
    ├── types/
    │   └── tenant.ts             # School, SchoolBranding, SchoolSettings, & default school seeds
    ├── lib/
    │   ├── api.ts                # Firestore data access layer (modularized into src/lib/api/* on main)
    │   ├── gender.ts             # Dynamic Hebrew grammar helper (boys/yeshiva vs girls/ulpana)
    │   ├── hebcal.ts             # Hebrew date, Shabbat/Yom Tov & advance quiz schedule logic
    │   └── badges.ts             # Student achievement badge definitions & evaluation
    └── components/
        ├── Navbar.tsx            # Top navigation bar with dynamic school branding & logo
        ├── HomeView.tsx          # Main dashboard (daily quiz CTA, dedication banner, leaderboards)
        ├── QuizFlow.tsx          # Daily Halacha reading & 4-question multiple-choice quiz flow
        ├── CalendarView.tsx      # Full-year Hebrew/Gregorian calendar with quiz status & annotations
        ├── ProfileModal.tsx      # Student profile, stats, badges, and history
        ├── AdminPanel.tsx        # School Manager dashboard (tabs under src/components/admin/tabs/ on main)
        └── admin/
            ├── HeadOfficePortal.tsx   # Dedicated Super Admin portal (?portal=headoffice)
            └── SchoolsManagerTab.tsx  # Multi-school CRUD, branding/logo uploader, manager sync
```

---

## 4. Firestore Data Model & Security Invariants

`firestore.rules` strictly enforces ownership, role-based access, and quiz submission integrity. **Never trust client-supplied role flags for authorization.**

| Collection | Document ID | Access & Purpose |
| :--- | :--- | :--- |
| **`schools`** | `{schoolId}` (e.g. `shvut-rachel`, `ybanm`) | Public read; Admin write. Stores school name, `institutionType` (`ulpana` \| `yeshiva`), `studentGender` (`female` \| `male`), `branding` (`primaryColor`, compressed base64 `logoUrl`), `classes`, `adminEmails`, and `settings`. |
| **`students`** | `{studentId}` | Private student record (`email`, `fullName`, `className`, `grade`, `schoolId`, `status` (`pending`\|`approved`\|`rejected`), `points`, `completedDates`, `submissions`). Students can only read/update their own document under strict field & score validation rules. |
| **`publicStudents`** | `{studentId}` | Sanitized leaderboard projection (`id`, `fullName`, `className`, `grade`, `points`, `completedDates`, `schoolId`). Contains **no emails or submission answers**. Updated alongside `students/{studentId}`. |
| **`managers`** | `{sanitized_email}` | Email normalized via `email.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_')` (e.g., `eladshneur_gmail_com`). Checked by `isAdmin()` in `firestore.rules`. Auto-synced when adding manager emails in `SchoolsManagerTab`. |
| **`halachot`** | `{YYYY-MM-DD}` | 489 daily Halacha lessons and 4 multiple-choice questions for 5787. Each has `correct_index` (`0..3`). |
| **`quizAvailability`** | `{YYYY-MM-DD}` | Pre-authorized advance completion dates (`allowedEarlyDates`, e.g., Friday for Shabbat, Erev Yom Tov). Validated by `firestore.rules` when a student submits an advance quiz. |
| **`settings`** | `classes`, `prizeMilestones`, `dailyQuizDedication`, `calendarAnnotations` | Global/default configuration documents. |
| **`suggestions` / `questionFeedback`** | Auto-ID | Student-submitted quiz suggestions and question feedback. |

### Critical Security Rules (`firestore.rules`)
1. **Super Admin vs School Manager**:
   - Super Admin is `skilead770@gmail.com`.
   - Any manager added to a school's `adminEmails` **must** also have a document in `/managers/{sanitized_email}` so `isAdmin()` in `firestore.rules` grants them write access to approve students and manage school settings.
2. **Student Quiz Submissions**:
   - Validated server-side in `firestore.rules` (`isValidStudentSelfSubmissionUpdate`):
   - Only `approved` students can submit.
   - Only one submission per `quizDate` is allowed (no overwriting completed dates).
   - `quizDate` must be today (`request.time` in Israel time) or explicitly listed in `quizAvailability/{quizDate}.allowedEarlyDates`.
   - Points delta must match the score (`0..40` points, 10 points per correct answer).

---

## 5. Multi-School (Multi-Tenant) System (`staging`)

1. **Tenant Resolution (`SchoolContext.tsx`)**:
   - Resolves active school in priority order:
     1. URL query parameter (`?school=ybanm`, `?school=even-shmuel`, `?school=shvut-rachel`) -> saved to `localStorage`.
     2. Authenticated student's `student.schoolId`.
     3. Authenticated manager's assigned school (`school.adminEmails` match).
     4. Previously persisted `localStorage` (`ulpaquiz_school_id`).
     5. Fallback default: `shvut-rachel`.
2. **Dynamic Hebrew Grammar (`src/lib/gender.ts`)**:
   - Uses `genderText(gender, { female: '...', male: '...' })` to adapt UI strings between Ulpana (female) and Yeshiva (male) contexts.
3. **Onboarding a New School**:
   - Open `/?portal=headoffice` as `skilead770@gmail.com`.
   - Create or edit the school, upload a logo (auto-compressed to < 25 KB PNG data URL), configure classes, and add manager `@gmail.com` addresses (auto-synced to `/managers/{sanitized_email}`).
   - Copy the school's registration link (`https://<host>/?school=<schoolId>`) and share it with the school's manager and students.

---

## 6. Local Development & Commands

### Prerequisites
- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)

### Key NPM Scripts
```bash
# Start local Vite dev server (http://localhost:3000)
npm run dev

# TypeScript type-check (must pass with 0 errors before committing)
npm run lint

# Build static production/staging bundle into dist/
npm run build:firebase

# Deploy to Staging (ulpaquiz-staging)
npm run deploy:staging

# Deploy Hosting + Firestore Rules to Staging
npm run deploy:staging:all
```

### Environment Variables (`.env.staging` / `.env.production`)
Vite loads `VITE_FIREBASE_*` variables at build time:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
