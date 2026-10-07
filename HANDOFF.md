# UlpaQuiz Project Review & Handoff Summary

**Date:** October 6, 2026  
**Active Branch:** [`staging`](https://github.com/skilead770/ulpaquiz/tree/staging)  
**Staging URL:** [https://ulpaquiz-staging.web.app](https://ulpaquiz-staging.web.app)  
**Production URL:** [https://ulpaquiz.web.app](https://ulpaquiz.web.app) *(Untouched, 15 active students)*

---

## 1. Initial Code Review Findings

During the initial review of the `ulpaquiz` codebase, several critical architectural and security concerns were identified:

1. **Architecture & Hosting Mismatch**:
   - The repository contained both a full Express server (`server.ts`) with a JSON database fallback (`data/db.json`) and a static React/Vite client.
   - However, deployment configuration (`firebase.json`) only deployed the static `dist/` directory to Firebase Hosting.
   - The Express backend was not running on Firebase Hosting, causing client fallback calls to `/api/*` to fail silently or loop.
2. **Firestore Quota Exhaustion (P0 Issue)**:
   - Fallback mechanisms in `src/lib/api.ts` were aggressively fetching and attempting to re-seed entire Firestore collections on failed queries.
   - This caused rapid depletion of the daily Spark quota (HTTP 429 `ResourceExhausted`).
3. **Manager Role Bootstrap Lockout**:
   - The system checked the `/managers` collection in Firestore to determine admin status.
   - If the database was empty, even the primary super admin (`skilead770@gmail.com`) could not be recognized as an admin or access the Admin Panel.
4. **Google OAuth Scope Warning**:
   - The login flow requested the sensitive Google Drive readonly scope (`drive.readonly`) for all users, triggering Google's unverified app warning screens for student logins.
5. **Obsolete Components**:
   - `src/components/ExcelUploader.tsx` and manual student rosters were obsolete because students self-register using Google SSO.

---

## 2. Work Completed This Session

### A. Isolated Staging Environment
- Created and configured a new Firebase project: **`ulpaquiz-staging`**.
- Added staging client configuration: `firebase-applet-config.staging.json`.
- Added `.env.staging` with `VITE_FIREBASE_PROJECT_ID="ulpaquiz-staging"`.
- Configured project aliases in `.firebaserc`.
- Deployed Firebase Hosting, Firestore security rules, and database indexes to `ulpaquiz-staging`.
- **Absolute production safety:** The production project `ulpaquiz` remained completely untouched.

### B. Fixed `Firebase: Error (auth/unauthorized-domain)`
- **Root Cause:** Dynamic environment evaluation (`Function('return ...')`) in `src/lib/config.ts` prevented Vite from statically replacing environment variables during build. The staging site fell back to the production configuration (`ulpaquiz`), which rejected the staging domain.
- **Fix:** Switched to direct static references to `import.meta.env.*` and added `src/vite-env.d.ts`. Rebuilt and redeployed staging hosting.

### C. Authentication & Role Authorization
- Hardcoded super admin recognition for `skilead770@gmail.com` in both `firestore.rules` and `src/lib/authService.ts`, ensuring immediate Admin Panel access.
- Restricted Google Drive scope requests only to administrative document import actions, preventing OAuth security warnings for regular students.

### D. Code Cleanup & Quota Fixes
- Fixed the Firestore loop in `src/lib/api.ts` to eliminate the quota exhaustion risk.
- Removed `src/components/ExcelUploader.tsx` and cleaned up `src/components/AdminPanel.tsx`.

### E. Quiz Date Availability & Seed Data
- **Root Cause for Missing Questions:** The student dashboard filters quizzes to the active window starting from today's date in Jerusalem (`2026-10-06`). The database only had mock entries from July/August.
- **Fix:** Seeded a daily Halacha with 4 multiple-choice questions for **`2026-10-06`** (*הלכות ברכות - ברכת המזון וברכות הנהנין*) into staging Firestore.
- Verified the registered test student account can log in, view today's Halacha, and take the quiz.

### F. Git Version Control
- Created and committed all changes to branch **`staging`**.
- Pushed branch to GitHub: [skilead770/ulpaquiz @ staging](https://github.com/skilead770/ulpaquiz/tree/staging).

---

## 3. How to Continue Tomorrow from a Different Computer

Follow these steps when setting up on your other machine:

```bash
# 1. Clone the repository and checkout the staging branch
git clone https://github.com/skilead770/ulpaquiz.git
cd ulpaquiz
git checkout staging

# 2. Install dependencies
npm install

# 3. Log in to Firebase CLI (if not already authenticated)
npm run firebase:login

# 4. Run local development server
npm run dev
```

### Useful Commands Reference
| Command | Purpose |
| :--- | :--- |
| `npm run lint` | TypeScript type-checking without emitting code |
| `npm run build:staging` | Build client bundle specifically for staging |
| `npm run deploy:staging` | Build and deploy static site to `ulpaquiz-staging` |
| `npm run deploy:staging:firestore` | Deploy Firestore security rules and indexes to staging |
| `npm run build:firebase` | Build production bundle |

---

## 4. Work Completed — October 7, 2026

1. **Firestore Full-Year Halachot Sync**:
   - Seeded all **489 Halachot** for Hebrew year 5787 (תשפ״ז) into the Firestore database.
   - Populated all Hebrew dates including Tishrei (`ט"ז בתשרי` - כבוד הסוכה, through `כ"ו בתשרי` - בישול בחמה, and beyond).
2. **Quota Read Optimization (98%+ reduction)**:
   - Updated `App.tsx` and `api.ts` so student visits only query their active 5-to-8 day date window via Firestore `in` queries (`where('date', 'in', ...)`).
   - Eliminated full-collection reads (`489 docs`) on every student page load, preventing Spark quota exhaustion.
   - Admins retain full visibility over all 489 days in the Admin Panel and Hebrew Calendar view.
3. **Serverless Batch Import in Admin Panel**:
   - Upgraded `bulkImportHalachotApi` in `src/lib/api.ts` to execute client-side `writeBatch` in 400-operation chunks.
   - Added a one-click sync button in `AdminPanel.tsx` under "ניהול הלכות" linked to lazy-loaded `yearHalachot.json`.
   - Added standalone `scripts/seed-halachot-firestore.mjs`.

---

## 5. Key Accounts & URLs

| Role / Asset | Value | Notes |
| :--- | :--- | :--- |
| **Staging App URL** | `https://ulpaquiz-staging.web.app` | Active test environment |
| **Super Admin Account** | `skilead770@gmail.com` | Automatically routed to Admin Panel |
| **Test Student Account** | *(Your registered student Gmail)* | Approved student in class ט'1 |
| **GitHub PR Link** | [Open Pull Request](https://github.com/skilead770/ulpaquiz/pull/new/staging) | For merging staging into main |

---

## 6. Recommended Next Steps

1. **Verify Student Experience**: Log in with your test student account on staging, check that today's date (`2026-10-07`) displays correctly, complete the quiz, and confirm points update.
2. **Admin AI Question Generation**: Use the Admin Panel to generate or review questions for upcoming dates.
3. **Production Deployment**: When ready, open the PR to merge `staging` into `main` and deploy to production.

