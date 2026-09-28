# UlpaQuiz Migration Plan

## Goal
Move the app from the current Node.js/Express setup to a Firebase-based architecture that remains compatible with a no-credit-card, no-billing setup.

This version is also aligned with the mobile-optimized app flow and keeps the project focused on a lightweight, free-tier-safe design.

---

## Why the migration is needed
The current app still depends on a custom server and a more traditional backend model. The long-term target is to reduce operational complexity and move the application to Firebase services that support hosting, auth, and data access without requiring a paid backend.

---

## Safe target architecture

### Current model
Frontend -> Express server -> data logic -> local DB / Firestore sync

### Target model
Frontend -> Firebase Auth -> Firestore -> Firebase Hosting

This gives us:
- simpler deployment
- no custom server to maintain
- easier mobile UX
- safer access control through Firestore Rules

---

## No-credit-card rule
This migration must stay on the Firebase free-tier path.

The following are allowed:
- Firebase Hosting
- Firebase Authentication
- Firestore
- Firebase project configuration without billing enabled

The following should be avoided unless they are clearly confirmed to remain free-tier-safe:
- Cloud Functions
- Cloud Storage
- paid APIs or external services
- any product that triggers a billing requirement
- advanced services that would force a Google payment method

> The simplest and safest migration path is: frontend + Firebase Auth + Firestore + Hosting only.

---

## Mobile-first guidance
Because the app has been adjusted for mobile phones, the migration should prioritize:
- responsive screens
- reduced server dependency
- fast frontend data loading
- mobile-friendly auth flow
- simplified interaction patterns

This means the final app should feel like a mobile app running on Firebase rather than a desktop web app with a hidden backend.

---

## Migration phases

### Phase 1: Audit current server responsibilities
Review the logic in the existing backend and classify each action as one of the following:
- public data
- user-scoped data
- admin-only data
- one-time migration/admin utility

This project includes features such as:
- student registration and approval
- daily halacha content
- quiz submissions
- leaderboard calculations
- invitation validation
- admin management

These need to be mapped into Firebase collections and rules.

### Phase 2: Move data to Firestore collections
Use collections such as:
- students
- halachot
- managers
- invitations
- classes
- settings

Focus on a data model that matches the app, not just a direct copy of the old server API.

### Phase 3: Replace backend auth with Firebase Auth
Use Firebase Authentication as the primary identity layer.

The final app should:
- sign in with Google or email auth
- read the authenticated user identity
- use Firestore Rules to decide what the user can access
- avoid custom backend session checks for normal app operations

### Phase 4: Enforce access via Firestore Security Rules
This is critical to secure the app without a custom backend.

The rules should enforce:
- only approved students can access their own data
- only admins can manage students, invitations, and classes
- halacha content is readable by students but protected from unauthorized writes
- submissions can only be made by the relevant student

### Phase 5: Remove all billing-triggering dependencies
Before final deployment:
- avoid adding paid Firebase features
- avoid custom server hosting
- avoid external services that require card verification
- keep the deployment in Firebase Hosting + Firestore + Auth only

---

## Project-specific notes
This project already has Firebase wiring and an app structure in place, so the migration should reuse the existing Firebase client setup rather than creating a second generic Firebase layer.

The key idea is not to recreate the old REST API exactly, but to replace server-side logic with:
- Firebase Auth for identity
- Firestore documents for state
- rules for authorization
- frontend logic for app behavior

---

## Deployment path without a credit card
The deployment should remain in a free-tier-safe setup:

```bash
npm install
npm run build
firebase login --no-localhost
firebase use <your-project-id>
firebase deploy --only hosting
```

Important:
- do not enable billing
- do not add paid services
- keep all production logic inside Firebase Hosting + Auth + Firestore

---

## Final acceptance criteria
The migration is successful only when all of the following are true:

- no custom server is required in production
- app data is stored in Firestore
- user access is enforced by Firebase Auth + rules
- the app works smoothly on mobile devices
- no credit card or billing setup is required
- the project remains within a free-tier-safe Firebase setup

---

## Recommendation
The safest final version of this app is:

- React frontend on Firebase Hosting
- Firebase Authentication for login
- Firestore for data storage
- Firestore Rules for authorization
- mobile-first UX
- no paid backend
- no credit card needed

This is the version that best matches the requirement and the current mobile-adjusted app direction.
