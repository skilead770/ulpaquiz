# UlpaQuiz Restart Checklist — 2026-09-28

## First 5 minutes
1. Open Firebase Console.
2. Go to Firestore Database → Usage.
3. Check whether the project is at or near its Firestore read quota.
4. Confirm which Firebase account is active and which project is selected.

## If the account is wrong
```powershell
firebase logout
firebase login --no-localhost
firebase projects:list
firebase use <project-id>
```

## If you need multiple accounts
```powershell
firebase login --reauth
firebase use --add
```

## Current code state to keep
- Blank invitation codes are now omitted instead of written as `undefined`.
- Manager participation flow is in place.
- Manager promotion from existing approved Gmail users is in place.
- The aggressive polling loop was removed.
- Retries were capped to avoid repeated quota hits.

## Current blocker
The app is still hitting Firestore 429 / `resource-exhausted` responses.

Do not keep clicking through the quiz while the quota is exhausted.
Instead:
- confirm Firestore usage in the Firebase Console,
- confirm project/account selection,
- wait for quota to reset or resolve,
- then re-test.

## What to do next if usage looks normal
- resume a focused app check,
- verify the student registration flow,
- verify manager participation + manager list behavior,
- confirm no more unbounded reads.

## What to do next if usage is exhausted
- stop repeated testing,
- wait for the quota window to reset,
- or decide whether the project needs a different account or a billing-enabled project setup.

## Quick command set
```powershell
firebase logout
firebase login --no-localhost
firebase use <project-id>
```

That is the safest restart point for tomorrow.
