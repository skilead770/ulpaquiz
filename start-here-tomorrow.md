# Start Here Tomorrow

## 1) Check the Firebase project/account
```powershell
firebase logout
firebase login --no-localhost
firebase use <project-id>
```

## 2) Check Firestore usage before testing anything
- Open Firebase Console
- Go to Firestore Database → Usage
- Look for read quota / 429 throttling

## 3) Keep these code fixes
- Blank invitation codes are omitted instead of written as `undefined`.
- Manager participation flow is in place.
- Manager promotion from existing approved Gmail users is in place.
- Aggressive admin polling was removed.
- Retry caps are in place.

## 4) Current blocker
The app is still hitting Firestore 429 / `resource-exhausted` errors.

Do not spam test the app while quota is exhausted. First confirm the quota/usage state.

## 5) Next move
If usage looks normal, resume a focused app test. If usage is exhausted, wait for quota recovery or check the different account/project setup.
