# UlpaQuiz agent guidance

## Project constraints

- UlpaQuiz is deployed on Firebase. Use Firebase Hosting and Firebase services; do not add Render configuration or deployment steps.
- The app is a React/TypeScript Vite project. `npm run lint` runs the TypeScript check, and `npm run build:firebase` builds the Hosting site.
- Firebase Hosting serves `dist` as a static SPA. Treat `firebase.json` as the deployment source of truth; do not assume the Express server is deployed with Hosting.
- Keep Firebase Authentication, Firestore rules, and client behavior consistent. Never grant manager permissions based on client-supplied role data.
- Student quiz submissions are validated by Firestore rules. Preserve ownership, quiz-date eligibility, answer/score integrity, and limits on writable fields when changing submission behavior.
- Shabbat and Yom Tov availability/parsha behavior is based on Hebcal. Preserve the existing schedule logic and verify affected calendar edge cases when changing it.

## Change and release practices

- Read current code and preserve unrelated worktree changes before editing.
- Prefer targeted checks first; use `npm run lint`, `npm run build:firebase`, and relevant Firebase rules checks for affected code.
- Never deploy or mutate production Firebase resources without explicit user approval for that operation.
- Do not add secrets, service-account keys, or user-specific machine paths to the repository.

## Relevant skills

Use the installed Firebase skills when their scope applies: `firebase-auth-basics`, `firebase-firestore`, `firestore-rules-creation`, `firebase-security-rules-auditor`, `firebase-hosting-basics`, and `firebase-basics`. Use `firebase-ai-logic-basics` only when changing Gemini/Firebase AI Logic features.
