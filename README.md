# UlpaQuiz

UlpaQuiz is a daily Halacha learning and quiz platform for students, managers, and administrators. Students complete daily study steps, answer short quizzes, earn points, and compete on leaderboards. Managers and admins can monitor participation, approve registrations, edit prizes, reset individual quiz attempts, and adjust scoring and milestones.

---

## What this app does

- Daily Halacha learning flow with structured steps
- Short quiz rounds with daily scoring
- Leaderboards for classes and students
- Manager and admin roles with role-based visibility
- Student registration and manager assignment flow
- Prize milestone editing and leaderboard rewards
- Data review and score resets for specific dates
- Gmail/Google-backed account validation for secure access

---

## Tech stack

- React + TypeScript + Vite
- Firebase Hosting
- Firebase Authentication and Firestore
- Node/Express server fallback for admin operations
- Tailwind-inspired UI patterns and React components

---

## Project structure

```text
ulpaquiz/
├── src/
│   ├── components/
│   ├── lib/
│   ├── data/
│   ├── App.tsx
│   ├── main.tsx
│   └── types.ts
├── server.ts
├── firestore.rules
├── firebase.json
├── vite.config.ts
├── package.json
├── README-for-developers.md
├── firestore.indexes.json
└── public/
```

---

## Local development

Install dependencies:

```bash
npm install
```

Run the app locally:

```bash
npm run dev
```

Build the frontend bundle:

```bash
npm run build:firebase
```

Run the full production build:

```bash
npm run build
```

---

## Firebase deployment

Login with the Firebase CLI:

```bash
npm run firebase:login
```

Deploy hosting:

```bash
npm run deploy:hosting
```

This project is configured to deploy the frontend to Firebase Hosting and uses the local Firestore/server fallback for admin tasks during the transition.

---

## Security and auth notes

This app has recently been hardened around Google/Gmail-only access controls and admin permissions. Important protections include:

- strict Gmail / Google email validation before allowing access
- admin-only checks for sensitive operations
- manager role validation to prevent unauthorized admin actions
- sanitization of Firestore writes before saving data
- guardrails for undefined values and stale/invalid manager records

This is especially important because the app handles student data, quiz tracking, and manager privileges.

---

## Recent fixes included in active development

The current branch includes work for:

- Google/Gmail security validation improvements
- manager and participant visibility fixes
- manager reset-score flow for a specific date
- prize editing and milestone updates
- quiz scoring adjustments and label clarity
- admin crash fixes and runtime error prevention
- Firestore undefined-field sanitization
- manager deletion reliability across normalized and legacy records
- broader admin UX stability and safer rendering paths

---

## Developer notes

For more operating details and role-specific implementation notes, see:

- [README-for-developers.md](README-for-developers.md)

The project is still evolving around Firebase-backed admin operations, role permissions, and secure student data workflows. Keep security and data validation in mind whenever editing Firestore writes or manager access logic.

---

## Recommended workflow before pushing

Before shipping changes:

```bash
npm run build:firebase
npm run deploy:hosting
```

Then verify in the browser that the manager/admin area loads correctly and that any data reset or manager-delete flow still behaves as expected.

---

## Notes for maintainers

- Always validate Gmail and admin-role checks before enabling manager-level actions.
- Avoid writing undefined values to Firestore documents.
- When modifying delete logic, check both the normalized doc ID and the stored email value.
- Use a hard refresh after deploy to avoid stale cached frontend bundles.
