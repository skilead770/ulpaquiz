# Firestore Security Review

Scope: close the student self-update path that previously allowed replacing an entire student record.

## Assumptions

- Students use verified Firebase Authentication accounts whose email matches the stored student email.
- A quiz submission adds one date to `completedDates`, one `submissions[date]` record, and one or two points.
- Each submission references its quiz document using `halachaId`; that document is authoritative for the date, enabled flag, and answer key.
- Registration still creates a constrained `pending` record before Google sign-in.
- Managers are stored in `managers/{sanitized-email}` and use verified Firebase email claims.

## Attack Checks

- Student changes to profile, email, status, arbitrary points, or another date's submission: denied by the owner update allowlist and submission validator.
- Submission for a disabled date or another date: denied unless it matches an enabled quiz document and the current Jerusalem-date candidates.
- The rules accept the UTC+2 or UTC+3 date candidate because Firestore Rules do not provide IANA timezone conversion. Around the UTC/local midnight boundary this can admit the adjacent date for a short window; the app and Express endpoint use exact `Asia/Jerusalem` time.
- Forged score, award amount, or answer keys: denied by comparing the submitted answers with the referenced quiz document.
- Unauthenticated or different-email quiz writes: denied by Firestore ownership checks; the Express fallback also verifies the Firebase token and email.
- Existing public student reads: still allowed to preserve current whole-collection app queries. This exposes profile fields and should be addressed by separating private student profiles from public leaderboard data.
- `password` remains an optional legacy field for compatibility; remove stored values and the field from the schema in a separate migration.

## Validation Limits

The Firestore emulator is unavailable here because Java is not installed. Firebase CLI dry-run compilation passes; rules behavior should still be exercised in the emulator before broad release.