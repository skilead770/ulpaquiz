import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  User as FirebaseUser,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from './firebaseClient';
import { Student, Manager } from '../types';

export interface AuthSession {
  user: FirebaseUser | null;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'admin' | 'student' | 'pending' | 'unauthorized' | null;
  studentData: Student | null;
  managerData: Manager | null;
  token: string | null;
}

/**
 * Sign in using Google SSO (signInWithPopup).
 * Requests user profile and email.
 */
export async function signInWithGoogleSSO(): Promise<FirebaseUser> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account',
  });
  
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

/**
 * Sign out current Firebase Auth user
 */
export async function signOutSSO(): Promise<void> {
  await firebaseSignOut(auth);
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
  return onAuthStateChanged(auth, callback);
}
