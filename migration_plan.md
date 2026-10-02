# Firebase Architecture Blueprint

## Goal
Use a Firebase-based architecture that stays inside the free-tier / no-billing path and does not require a Google payment method.

This plan is intentionally designed to avoid any feature that typically triggers billing or a credit-card requirement.

---

## 1. Core Principle: Stay on the no-billing path

The migration should only use services that are safe for a free Firebase project:

- Firebase Hosting
- Firebase Authentication
- Firestore
- Firebase App configuration

This plan deliberately avoids:

- Cloud Functions (unless absolutely required and only after confirming billing-free usage)
- Cloud Storage
- Cloud Run
- AI/GenAI services that require billing
- any extension, backend service, or external platform that asks for a billing account
- any paid database or custom server deployment

> The safest version of this migration is: frontend app + Firebase Auth + Firestore only.

---

## 2. Target Architecture

[Frontend App] -> [Firebase Auth] -> [Firestore] -> [Firebase Hosting]

This means the browser talks directly to Firebase, and access control is enforced with Firestore Security Rules instead of a custom Node server.

---

## 3. Migration Rules for This Project

### Rule 1: Do not add paid Firebase products
Before adding any Firebase product, confirm that it is available without enabling billing.

For this app, the safe baseline is:
- Firebase Hosting
- Firebase Auth
- Firestore
- existing frontend app logic only

### Rule 2: Keep the backend server out of the final architecture
The current Express server in [server.ts](server.ts) should be treated as a migration boundary, not a permanent component.

Move server responsibilities into one of these categories:

- Client-side Firestore access for normal reads/writes
- Firebase Auth for user identity
- Firestore Security Rules for admin-only access
- one-time migration script only, not long-lived server code

### Rule 3: Avoid custom backend auth that depends on billing
Do not depend on:
- Cloud Functions for every route
- custom JWT validation services running on paid infrastructure
- email sending services that require billing
- external secret stores that force paid setup

If admin-only logic is required, prefer rules + identity checks + secure Firestore access instead of a custom backend.

---

## 4. Project-Specific Migration Plan

### Phase 1: Audit the current server responsibilities
Review the current server features in [server.ts](server.ts) and classify each route:

- public data: read directly from Firestore
- logged-in user data: read/write only when `request.auth != null`
- admin-only data: allow only for approved managers
- one-time admin operations: move to Firebase console or a local migration script

Examples from this project:
- student list / halacha data / leaderboard data -> Firestore collections
- admin management -> Firestore rules + admin UID checks
- registration / approval state -> Firestore documents with status field
- quiz submissions -> Firestore writes by authorized student

### Phase 2: Replace server-backed data access with Firestore collections
The app already has a Firebase client layer in [src/lib/firebaseClient.ts](src/lib/firebaseClient.ts), so the migration should use that instead of creating a second generic Firebase setup.

Use collections similar to:

- `students`
- `halachot`
- `invitations`
- `managers`
- `classes`
- `settings`

The goal is not to recreate the old server API exactly. The goal is to convert the app to a document-based model that matches the app's real needs.

### Phase 3: Replace backend login checks with Firebase Auth
Use Firebase Authentication and store only the user identity in the client.

Do not rely on a server-generated session token for the final version.

For this app, the login flow should be:

- user signs in with Google or email-based Firebase auth
- app reads the current user UID/email
- Firestore rules enforce whether the user is a student or admin
- the app reads only the documents that the user is allowed to see

### Phase 4: Implement Firestore Security Rules
This is the core of the no-card migration.

The rules must protect every collection:

- only approved students can read student profiles for themselves
- only admins can approve or reject registrations
- only admins can manage invitations or managers
- daily halacha content can be readable by students but not editable by them
- quiz submissions can be written only by that student and only once per date if required

A safe pattern for this app is:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return isSignedIn() && exists(/databases/$(database)/documents/managers/$(request.auth.token.email))
        && get(/databases/$(database)/documents/managers/$(request.auth.token.email)).data.email == request.auth.token.email;
    }

    match /students/{studentId} {
      allow read: if isSignedIn() && (
        request.auth.token.email == resource.data.email ||
        request.auth.token.email == resource.data.managerEmail ||
        isAdmin()
      );
      allow create: if isSignedIn() && request.resource.data.email == request.auth.token.email;
      allow update, delete: if isAdmin() || (
        isSignedIn() && resource.data.email == request.auth.token.email
      );
    }

    match /halachot/{docId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    match /invitations/{docId} {
      allow read: if isAdmin();
      allow write: if isAdmin();
    }

    match /managers/{docId} {
      allow read: if isAdmin();
      allow write: if isAdmin();
    }
  }
}
```

### Phase 5: Remove all billing-triggering dependencies
Before final deployment, remove or avoid anything that could force a card:

- no Cloud Functions unless absolutely necessary
- no Storage unless needed and verified as free-tier-safe
- no scheduled jobs tied to paid infrastructure
- no external service requiring credit card verification
- no app hosting beyond Firebase Hosting

### Phase 6: Keep the project as a free-tier-first deployment
Use Firebase Hosting and Firebase project defaults only.

Do not add:
- billing-enabled project settings
- paid Google Cloud products
- backup systems tied to billable services
- advanced APIs that require billing setup

---

## 5. Dependencies to Remove or Keep

### Remove from package.json
- `express`
- `cors`
- backend-only DB drivers
- token validation libraries that only exist because of the custom server
- any server package used only to support paid hosting or billable APIs

### Keep / add only if necessary
- `firebase` (web SDK)
- Vite / React app dependencies
- TypeScript tooling

This migration should not introduce a new paid backend stack.

---

## 6. Deployment Plan Without a Credit Card

### Safe deployment flow
```bash
npm install
npm run build
firebase login --no-localhost
firebase use <your-project-id>
firebase deploy --only hosting
```

### Important checks
- Confirm the Firebase project is a free-tier project.
- Do not enable billing in the Firebase console.
- Do not add any product that triggers a billing requirement.
- Keep all app logic inside Hosting + Auth + Firestore.

---

## 7. Final Acceptance Criteria

The migration is complete only when all of the following are true:

- the app runs from Firebase Hosting
- student and admin access is controlled by Firebase Auth + Firestore rules
- no Express server is required in production
- no credit card is required to create or maintain the project
- no billable Google product is enabled
- the app still works for school quiz management, registration, approval flow, and scoring

---

## 8. Recommended Bottom Line

The safest, cleanest version of this migration is:

- React frontend on Firebase Hosting
- Firebase Authentication for login
- Firestore for all app data
- Firebase Security Rules for authorization
- no custom backend
- no credit card setup required

This is the version most consistent with the requirement: no credit card from Google services and no paid migration path.
