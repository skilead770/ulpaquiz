import {
  GoogleAuthProvider,
  onIdTokenChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  User as FirebaseUser,
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth';
import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { auth, db } from './firebaseClient';
import { Student, Manager } from '../types';
import { validateGmailAddress } from './gmailValidator';

export interface AuthSession {
  user: FirebaseUser | null;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'admin' | 'student' | 'pending' | 'unauthorized' | null;
  studentData: Student | null;
  managerData: Manager | null;
  token: string | null;
  googleAccessToken?: string | null;
}

let cachedGoogleAccessToken: string | null = null;

export function getCachedGoogleAccessToken(): string | null {
  return cachedGoogleAccessToken;
}

export function validateSecureGoogleGmail(firebaseUser: FirebaseUser | null): {
  isValid: boolean;
  normalizedEmail?: string;
  error?: string;
} {
  const email = (firebaseUser?.email || '').trim().toLowerCase();

  if (!email) {
    return {
      isValid: false,
      error: 'לא נמצא חשבון Google מחובר.',
    };
  }

  if (firebaseUser?.emailVerified === false) {
    return {
      isValid: false,
      error: 'החשבון Google חייב להיות מאומת לפני הכניסה למערכת.',
    };
  }

  const validation = validateGmailAddress(email);
  if (!validation.isValid || !validation.normalizedEmail) {
    return {
      isValid: false,
      error: validation.error || 'כניסה מאובטחת דורשת כתובת Gmail תקינה.',
    };
  }

  return {
    isValid: true,
    normalizedEmail: validation.normalizedEmail,
  };
}

/**
 * Sign in using Google SSO (signInWithPopup).
 * Requests user profile, email and Drive readonly scope for importing documents.
 */
export async function signInWithGoogleSSO(requestDriveScope = false): Promise<{ user: FirebaseUser; accessToken?: string }> {
  await setPersistence(auth, browserLocalPersistence);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account',
  });
  
  // CRITICAL: ONLY add drive.readonly scope if explicitly requested (by admin importing docs)
  // Regular students logging in MUST NOT request Drive scope so Google does NOT block them as test users!
  if (requestDriveScope) {
    provider.addScope('https://www.googleapis.com/auth/drive.readonly');
  }
  
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    cachedGoogleAccessToken = credential.accessToken;
  }
  return { user: result.user, accessToken: cachedGoogleAccessToken || undefined };
}

/**
 * Sign out current Firebase Auth user
 */
export async function signOutSSO(): Promise<void> {
  cachedGoogleAccessToken = null;
  await firebaseSignOut(auth);
}

/**
 * Resolve the Firebase-authenticated user's current role directly from Firestore.
 * This is the first migration chunk: it removes dependence on the custom backend
 * for the normal auth decision while keeping the backend as an emergency fallback.
 */
export async function resolveFirebaseUserSession(firebaseUser: FirebaseUser | null): Promise<{
  success: boolean;
  role: 'admin' | 'student' | 'pending' | 'rejected' | 'unauthorized';
  email: string;
  name?: string;
  picture?: string;
  student?: Student;
  manager?: Manager;
  message?: string;
  error?: string;
}> {
  const email = (firebaseUser?.email || '').trim().toLowerCase();
  const name = firebaseUser?.displayName || undefined;
  const picture = firebaseUser?.photoURL || undefined;

  if (!firebaseUser) {
    return {
      success: false,
      role: 'unauthorized',
      email,
      name,
      picture,
      message: 'לא נמצא חשבון Google מחובר.',
      error: 'MISSING_USER',
    };
  }

  const secureCheck = validateSecureGoogleGmail(firebaseUser);
  if (!secureCheck.isValid) {
    return {
      success: false,
      role: 'unauthorized',
      email,
      name,
      picture,
      message: secureCheck.error || 'כניסה מאובטחת דורשת חשבון Google תקין.',
      error: 'UNSAFE_GOOGLE_ACCOUNT',
    };
  }

  const normalizedEmail = secureCheck.normalizedEmail || email;

  try {
    const managersRef = collection(db, 'managers');
    const managerQuery = query(managersRef, where('email', '==', email));
    const managerSnap = await getDocs(managerQuery);

    if (!managerSnap.empty) {
      const manager = managerSnap.docs[0].data() as Manager;
      return {
        success: true,
        role: 'admin',
        email: normalizedEmail,
        name: name || manager.name || normalizedEmail.split('@')[0],
        picture,
        manager,
        message: `שלום מנהל המערכת (${manager.name || normalizedEmail})!`,
      };
    }

    const studentsRef = collection(db, 'students');
    const studentQuery = query(studentsRef, where('email', '==', normalizedEmail));
    const studentSnap = await getDocs(studentQuery);

    if (!studentSnap.empty) {
      const student = studentSnap.docs[0].data() as Student;

      if (student.status === 'pending') {
        return {
          success: false,
          role: 'pending',
          email: normalizedEmail,
          name: student.fullName || name || normalizedEmail.split('@')[0],
          picture,
          student,
          message: `שלום ${student.fullName}! בקשת ההרשמה שלך ממתינה לאישור מנהל האולפנה.`,
        };
      }

      if (student.status === 'rejected') {
        return {
          success: false,
          role: 'rejected',
          email: normalizedEmail,
          name: student.fullName || name || normalizedEmail.split('@')[0],
          picture,
          student,
          message: `בקשת ההרשמה של ${student.fullName} נדחתה. נא לפנות להנהלת האולפנה.`,
          error: 'STUDENT_REJECTED',
        };
      }

      if (student.status !== 'approved') {
        return {
          success: false,
          role: 'unauthorized',
          email: normalizedEmail,
          name: student.fullName || name || normalizedEmail.split('@')[0],
          picture,
          student,
          message: 'ההרשמה עדיין אינה מאושרת. יש לפנות להנהלת האולפנה.',
          error: 'STUDENT_NOT_APPROVED',
        };
      }

      return {
        success: true,
        role: 'student',
        email: normalizedEmail,
        name: student.fullName || name || normalizedEmail.split('@')[0],
        picture,
        student,
        message: `שלום ${student.fullName}! התחברת בהצלחה.`,
      };
    }

    return {
      success: false,
      role: 'unauthorized',
      email: normalizedEmail,
      name,
      picture,
      message: `חשבון Google זה (${normalizedEmail}) אינו רשום עדיין במערכת. אנא הרשמי למבצע.`,
    };
  } catch (err: any) {
    console.warn('[Auth] Firebase direct auth resolution failed, falling back to backend:', err);
    try {
      const fallback = await verifyBackendToken(await firebaseUser.getIdToken());
      return {
        success: fallback.success,
        role: fallback.role,
        email: fallback.email,
        name: fallback.name,
        picture: fallback.picture,
        student: fallback.student,
        manager: fallback.manager,
        message: fallback.message,
        error: fallback.error,
      };
    } catch (fallbackError) {
      console.error('[Auth] Backend identity fallback failed:', fallbackError);
    }
    return {
      success: false,
      role: 'unauthorized',
      email,
      name,
      picture,
      message: 'אימות המשתמש מול Firebase נכשל. מנסה גיבוי מאובטח...',
      error: 'DIRECT_AUTH_FAILED',
    };
  }
}

/**
 * Verify current Firebase ID token with backend
 */
export async function verifyBackendToken(idToken: string): Promise<{
  success: boolean;
  role: 'admin' | 'student' | 'pending' | 'unauthorized';
  email: string;
  name?: string;
  picture?: string;
  student?: Student;
  manager?: Manager;
  message?: string;
  error?: string;
}> {
  const res = await fetch('/api/auth/verify-google', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ token: idToken }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'אימות מול השרת נכשל');
  }
  return data;
}

/**
 * Listen to auth state changes
 */
export function subscribeToAuth(callback: (user: FirebaseUser | null) => void) {
  return onIdTokenChanged(auth, callback);
}
