import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebaseClient';
import { API_BASE_URL } from '../config';
import { SchoolConfig, Manager, DEFAULT_CLASSES } from '../../types';
import { getAuthHeaders } from './core';

let inMemoryActiveSchoolId: string = 'even-shmuel';

export function getActiveSchoolId(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('ulpaquiz_active_school_id');
    if (stored && stored.trim()) {
      return stored.trim();
    }
  }
  return inMemoryActiveSchoolId;
}

export function setActiveSchoolId(schoolId: string): void {
  const clean = (schoolId || '').trim().toLowerCase();
  inMemoryActiveSchoolId = clean || 'even-shmuel';
  if (typeof window !== 'undefined') {
    localStorage.setItem('ulpaquiz_active_school_id', inMemoryActiveSchoolId);
  }
}

export async function fetchSchoolsApi(): Promise<SchoolConfig[]> {
  try {
    const snap = await getDocs(collection(db, 'schools'));
    if (!snap.empty) {
      return snap.docs.map((docSnap) => docSnap.data() as SchoolConfig);
    }
  } catch (err) {
    console.warn('[Firestore] Error fetching schools, checking server API:', err);
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/schools`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (apiErr) {
    console.warn('[API] Server schools lookup note:', apiErr);
  }

  return [];
}

export async function createSchoolApi(schoolData: SchoolConfig): Promise<{
  success: boolean;
  school: SchoolConfig;
}> {
  const schoolId = schoolData.id.trim().toLowerCase();
  if (!schoolId) {
    throw new Error('יש לציין מזהה מוסד (slug) תקין');
  }
  if (!schoolData.name.trim()) {
    throw new Error('יש לציין שם מוסד');
  }
  const cleanEmail = schoolData.mainManagerEmail.trim().toLowerCase();
  if (!cleanEmail.includes('@')) {
    throw new Error('יש לציין כתובת Gmail תקינה עבור המנהל/ת הראשי/ת');
  }

  // 1. First, attempt direct write via Firestore Client SDK
  let firestoreSuccess = false;
  let firestoreError: any = null;

  try {
    const schoolDocRef = doc(db, 'schools', schoolId);
    await setDoc(schoolDocRef, {
      ...schoolData,
      id: schoolId,
      name: schoolData.name.trim(),
      mainManagerEmail: cleanEmail,
      createdAt: schoolData.createdAt || new Date().toISOString(),
      active: true,
    });

    const managerDocId = cleanEmail.replace(/[^a-zA-Z0-9_]/g, '_');
    const managerDocRef = doc(db, 'schools', schoolId, 'managers', managerDocId);
    const newManager: Manager = {
      email: cleanEmail,
      name: schoolData.mainManagerName?.trim() || `${schoolData.name} - רכז`,
      role: 'admin',
      addedAt: new Date().toISOString(),
    };
    await setDoc(managerDocRef, newManager);

    try {
      const rootMgrRef = doc(db, 'managers', managerDocId);
      await setDoc(rootMgrRef, newManager, { merge: true });
    } catch (e) {
      console.info('[Firestore] Root manager backup sync note:', e);
    }

    const classesDocRef = doc(db, 'schools', schoolId, 'settings', 'classes');
    await setDoc(classesDocRef, {
      list: schoolData.defaultClasses && schoolData.defaultClasses.length > 0
        ? schoolData.defaultClasses
        : DEFAULT_CLASSES,
    });

    const cleanPrefix = schoolId.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const defaultInvCode = `${cleanPrefix}2026`;
    const invDocRef = doc(db, 'schools', schoolId, 'invitations', 'default');
    await setDoc(invDocRef, {
      id: `inv-${schoolId}-main`,
      code: defaultInvCode,
      className: 'כללית',
      grade: 'ט',
      maxUses: 500,
      usedCount: 0,
      createdAt: new Date().toISOString().split('T')[0],
      active: true,
    });

    firestoreSuccess = true;
  } catch (err: any) {
    firestoreError = err;
    console.warn('[Firestore] Direct write failed, falling back to server API:', err?.message || err);
  }

  if (firestoreSuccess) {
    return { success: true, school: schoolData };
  }

  // 2. Fallback to Server API endpoint (uses Admin SDK / server authority)
  try {
    const res = await fetch(`${API_BASE_URL}/api/schools`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(schoolData),
    });

    if (res.ok) {
      const result = await res.json();
      return { success: true, school: result.school || schoolData };
    }

    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || firestoreError?.message || 'שגיאה בהקמת המוסד');
  } catch (apiErr: any) {
    console.error('[API] Server fallback also failed:', apiErr);
    throw new Error(
      apiErr?.message || firestoreError?.message || 'שגיאה בהקמת המוסד. אנא ודא הרשאות מנהל ונסה שנית.'
    );
  }
}

export async function updateSchoolApi(
  schoolId: string,
  updates: Partial<SchoolConfig>
): Promise<SchoolConfig> {
  const cleanId = schoolId.trim().toLowerCase();
  const schoolDocRef = doc(db, 'schools', cleanId);
  await updateDoc(schoolDocRef, updates);
  const updatedSnap = await getDoc(schoolDocRef);
  return updatedSnap.data() as SchoolConfig;
}

export async function deleteSchoolApi(schoolId: string): Promise<boolean> {
  const cleanId = schoolId.trim().toLowerCase();
  if (cleanId === 'even-shmuel' || cleanId === 'default') {
    throw new Error('לא ניתן למחוק את מוסד ברירת המחדל');
  }

  let firestoreSuccess = false;
  try {
    const schoolDocRef = doc(db, 'schools', cleanId);
    await deleteDoc(schoolDocRef);
    firestoreSuccess = true;
  } catch (err) {
    console.warn('[Firestore] Direct delete failed, falling back to server API:', err);
  }

  if (firestoreSuccess) {
    return true;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/schools/${cleanId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      return true;
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'שגיאה במחיקת המוסד');
  } catch (apiErr: any) {
    throw new Error(apiErr?.message || 'שגיאה במחיקת המוסד');
  }
}
