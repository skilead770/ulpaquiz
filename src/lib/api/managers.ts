import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebaseClient';
import { SUPER_ADMIN_EMAIL } from '../config';
import { Manager } from '../../types';
import { INITIAL_MANAGERS } from '../../data/seedData';
import { getAuthHeaders, parseJsonResponse } from './core';

export async function fetchManagersApi(): Promise<Manager[]> {
  try {
    const snap = await getDocs(collection(db, 'managers'));
    if (!snap.empty) {
      const list: Manager[] = [];
      snap.forEach((d) => list.push(d.data() as Manager));
      if (!list.some((m) => m.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase())) {
        list.unshift(INITIAL_MANAGERS[0]);
      }
      return list;
    }

    if (INITIAL_MANAGERS.length) {
      await setDoc(doc(db, 'managers', 'super_admin'), INITIAL_MANAGERS[0]);
    }
    return INITIAL_MANAGERS;
  } catch (err) {
    console.warn('[Firestore Fallback] Error fetching managers:', err);
  }

  try {
    const res = await fetch('/api/managers', {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for fetchManagersApi');
  }

  return INITIAL_MANAGERS;
}

export async function addManagerApi(
  email: string,
  name: string
): Promise<{ success: boolean; managers: Manager[] }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.includes('@')) {
    throw new Error('נא להזין כתובת Gmail תקינה');
  }

  try {
    const snap = await getDocs(collection(db, 'managers'));
    const exists = snap.docs.some((d) => (d.data() as Manager).email.toLowerCase() === cleanEmail);
    if (exists) {
      throw new Error('מנהל זה כבר רשום במערכת');
    }

    const newMgr: Manager = {
      email: cleanEmail,
      name: name.trim() || cleanEmail.split('@')[0],
      role: 'admin',
      addedAt: new Date().toISOString(),
    };
    const safeId = cleanEmail.replace(/[^a-zA-Z0-9_]/g, '_');
    await setDoc(doc(db, 'managers', safeId), newMgr);
    const managers = await fetchManagersApi();
    return { success: true, managers };
  } catch (e: any) {
    if (e.message && (e.message.includes('Gmail') || e.message.includes('כבר רשום'))) {
      throw e;
    }
    console.info('[Firestore] Direct manager creation failed, trying legacy API:', e);
  }

  try {
    const res = await fetch('/api/managers', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ email, name }),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    } else {
      const err = await parseJsonResponse(res).catch(() => ({ error: 'שגיאה בהוספת מנהל' }));
      throw new Error(err.error || 'שגיאה בהוספת מנהל');
    }
  } catch (e: any) {
    if (e.message && (e.message.includes('Gmail') || e.message.includes('מנהל זה כבר רשום'))) {
      throw e;
    }
    console.info('[API] Falling back to seeded Firestore for addManagerApi');
  }

  const newMgr: Manager = {
    email: cleanEmail,
    name: name.trim() || cleanEmail.split('@')[0],
    role: 'admin',
    addedAt: new Date().toISOString(),
  };
  const safeId = cleanEmail.replace(/[^a-zA-Z0-9_]/g, '_');
  await setDoc(doc(db, 'managers', safeId), newMgr);
  const managers = await fetchManagersApi();
  return { success: true, managers };
}

export async function deleteManagerApi(
  email: string
): Promise<{ success: boolean; managers: Manager[] }> {
  const cleanEmail = email.trim().toLowerCase();
  if (cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
    throw new Error('לא ניתן למחוק את מנהל המערכת הראשי');
  }

  try {
    const safeId = cleanEmail.replace(/[^a-zA-Z0-9_]/g, '_');
    const managerSnap = await getDocs(collection(db, 'managers'));
    const matches = managerSnap.docs.filter((docSnap) => {
      const data = docSnap.data() as Partial<Manager>;
      return docSnap.id === safeId || (data.email || '').trim().toLowerCase() === cleanEmail;
    });

    if (matches.length > 0) {
      await Promise.all(matches.map((docSnap) => deleteDoc(docSnap.ref)));
    }

    const managers = await fetchManagersApi();
    return { success: true, managers };
  } catch (e: any) {
    if (e.message && e.message.includes('לא ניתן למחוק')) {
      throw e;
    }
    console.info('[Firestore] Direct manager delete failed, trying legacy API:', e);
  }

  try {
    const res = await fetch(`/api/managers/${encodeURIComponent(email)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    } else {
      const err = await parseJsonResponse(res).catch(() => ({ error: 'שגיאה במחיקת מנהל' }));
      throw new Error(err.error || 'שגיאה במחיקת מנהל');
    }
  } catch (e: any) {
    if (e.message && e.message.includes('לא ניתן למחוק')) {
      throw e;
    }
    console.info('[API] Falling back to seeded Firestore for deleteManagerApi');
  }

  const managerSnap = await getDocs(collection(db, 'managers'));
  const matches = managerSnap.docs.filter((docSnap) => {
    const data = docSnap.data() as Partial<Manager>;
    return docSnap.id === cleanEmail.replace(/[^a-zA-Z0-9_]/g, '_') || (data.email || '').trim().toLowerCase() === cleanEmail;
  });

  if (matches.length > 0) {
    await Promise.all(matches.map((docSnap) => deleteDoc(docSnap.ref)));
  }

  const managers = await fetchManagersApi();
  return { success: true, managers };
}
